import fs from 'fs';
import path from 'path';
import { Type } from '@google/genai';
import { env } from '../config/env';
import { getGenAI } from './geminiClient';
import { parseJsonWithRepair } from './jsonRepair';
import { pdfExtractor } from './pdfExtractor';
import { ParsedQuote } from './quoteParser';
import { auditReportCompliance, type RegulatoryAuditableQuote } from './regulatoryAuditService';
import { sanitizeForPostgres } from '../utils/stringUtils';
import {
  COLOMBIA_SMMLV_2026,
  addContractTerm,
  computeCoverageValidityDates,
  resolveContractStartDate,
  type ContractDurationUnit,
} from '../utils/colombianCalendar';
import {
  calculateDecreto1082RceMinSmmlv,
  evaluateDecreto1082Rules,
} from './cumplimientoAuditService';
import type {
  CumplimientoGoverningGap,
  CumplimientoProcessStage,
  GoverningDocumentAudit,
  RegulatoryCheckResult,
} from '../types';
import type {
  CumplimientoCaseType,
  CumplimientoContractType,
  CumplimientoCoveragePhase,
  CumplimientoLegalRegime,
  CumplimientoPersonType,
  CumplimientoPrepolicyData,
  CumplimientoRceAdditionalCoverage,
  CumplimientoRequiredCoverageItem,
} from '../types/cumplimientoCase';

export interface GoverningRequiredCoverage {
  name: string;
  canonicalName?: string | null;
  percentageOfContract?: string | null;
  minimumAmount?: number | null;
  validityRule?: string | null;
  isMandatory?: boolean;
  notes?: string | null;
  rawTextSnippet?: string | null;
  pageNumber?: number | null;
}

export interface GoverningDocumentSpec {
  documentName: string;
  stage: CumplimientoProcessStage;
  legalRegime?: string | null;
  processOrContractNumber?: string | null;
  entityName?: string | null;
  contractorName?: string | null;
  contractOrBudgetValue?: number | null;
  contractDuration?: string | null;
  requiredCoverages: GoverningRequiredCoverage[];
}

const GOVERNING_DOC_SCHEMA = {
  type: Type.OBJECT,
  description:
    'Exigencias de garantías extraídas de un Pliego de Condiciones, Minuta de Contrato u Otrosí',
  properties: {
    detectedStage: {
      type: Type.STRING,
      description: 'LICITACION | CONTRATO | OTROSI',
    },
    legalRegime: {
      type: Type.STRING,
      description: 'ESTATAL_LEY_80 | PARTICULAR | REGIMEN_ESPECIAL',
      nullable: true,
    },
    processOrContractNumber: { type: Type.STRING, nullable: true },
    entityName: { type: Type.STRING, nullable: true },
    contractorName: { type: Type.STRING, nullable: true },
    contractOrBudgetValue: { type: Type.NUMBER, nullable: true },
    contractDuration: { type: Type.STRING, nullable: true },
    requiredCoverages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Nombre del amparo exigido' },
          canonicalName: { type: Type.STRING, nullable: true },
          percentageOfContract: {
            type: Type.STRING,
            description: 'Ej: 10%, 20%, 100% del anticipo, 5%, 200 SMMLV',
            nullable: true,
          },
          minimumAmount: {
            type: Type.NUMBER,
            description: 'Monto mínimo calculado o explícito en COP si aplica',
            nullable: true,
          },
          validityRule: {
            type: Type.STRING,
            description:
              'Vigencia exigida (ej: Plazo + 3 años, 5 años desde recibo final, 120 días desde cierre)',
            nullable: true,
          },
          isMandatory: { type: Type.BOOLEAN, nullable: true },
          notes: { type: Type.STRING, nullable: true },
          rawTextSnippet: { type: Type.STRING, nullable: true },
          pageNumber: { type: Type.NUMBER, nullable: true },
        },
        required: ['name'],
      },
    },
  },
  required: ['detectedStage', 'requiredCoverages'],
};

function normalizeStage(
  rawStage?: string | null,
  fallback: CumplimientoProcessStage = 'AUTO'
): CumplimientoProcessStage {
  const s = (rawStage || '').toUpperCase();
  if (s.includes('LICIT') || s.includes('PRECONTRACT') || s.includes('PLIEGO')) return 'LICITACION';
  if (s.includes('OTROSI') || s.includes('MODIFIC') || s.includes('ADICION')) return 'OTROSI';
  if (s.includes('CONTRAT') || s.includes('MINUTA') || s.includes('EJECUC')) return 'CONTRATO';
  return fallback;
}

function normalizeLabel(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extractNumericPercentage(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]!) : null;
}

function extractNumericCOP(raw?: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes('.') && cleaned.split('.').slice(-1)[0]?.length === 3
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseValidityYears(raw?: string | null): number | null {
  if (!raw) return null;
  const years = raw.match(/(\d+)\s*a[ñn]o/i);
  if (years) return parseInt(years[1]!, 10);
  const months = raw.match(/(\d+)\s*mes/i);
  if (months) return parseInt(months[1]!, 10) / 12;
  return null;
}

/**
 * Extract contractual guarantee requirements from one or more Governing Documents
 * (Pliego de Condiciones, Minuta de Contrato, Otrosí) using native PDF text + Gemini.
 */
export async function extractGoverningRequirements(
  pdfPaths: string[],
  requestedStage: CumplimientoProcessStage = 'AUTO'
): Promise<GoverningDocumentSpec> {
  const docNames = pdfPaths.map((p) => path.basename(p)).join(', ') || 'Documento Rector';
  const combinedTexts: string[] = [];

  for (const pdfPath of pdfPaths) {
    if (!fs.existsSync(pdfPath)) continue;
    try {
      const extracted = await pdfExtractor.extractTextFromPdf(pdfPath);
      if (extracted?.text) {
        combinedTexts.push(extracted.text.slice(0, 45000));
      }
    } catch {
      // Non-fatal: continue with other files or return fallback skeleton
    }
  }

  const fallbackSpec: GoverningDocumentSpec = {
    documentName: docNames,
    stage: requestedStage,
    requiredCoverages: [],
  };

  if (combinedTexts.length === 0) {
    return fallbackSpec;
  }

  try {
    const ai = getGenAI();
    const stageHint =
      requestedStage !== 'AUTO'
        ? `Etapa indicada por el analista: ${requestedStage}.`
        : 'Detecta automáticamente si el documento es LICITACION (Pliego), CONTRATO (Minuta) u OTROSI.';

    const prompt = `Eres un auditor jurídico especialista en Contratación Estatal (Ley 80/1993, Decreto 1082/2015) y Contratación Privada en Colombia.
Analiza el siguiente DOCUMENTO RECTOR (Pliego de Condiciones, Minuta de Contrato u Otrosí) y extrae EXCLUSIVAMENTE las exigencias de pólizas, garantías, porcentajes, cuantías y vigencias solicitadas al proponente/contratista.

${stageHint}

REGLAS ESTRICTAS:
1. En "requiredCoverages" lista cada amparo exigido por el documento (ej: Seriedad de la Oferta, Cumplimiento del Contrato, Buen Manejo y Correcta Inversión del Anticipo, Pago de Salarios y Prestaciones Sociales, Estabilidad y Calidad de la Obra, Calidad del Bien o Servicio, Responsabilidad Civil Extracontractual Derivada).
2. Registra el porcentaje exacto exigido ("percentageOfContract", ej. "10%", "20%", "100% del anticipo", "5%", o "200 SMMLV").
3. Si el documento indica el presupuesto oficial o valor total del contrato ("contractOrBudgetValue"), calcula o extrae el monto mínimo en COP ("minimumAmount") para cada amparo porcentual.
4. Extrae la vigencia exigida exacta en "validityRule" (ej: "120 días desde el cierre", "Plazo de ejecución + 6 meses liquidación", "Plazo de ejecución + 3 años", "5 años desde acta de recibo final").
5. No inventes requisitos que no estén en el texto.

TEXTO DEL DOCUMENTO RECTOR:
${combinedTexts.join('\n\n--- SIGUIENTE DOCUMENTO ---\n\n').slice(0, 60000)}`;

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: [{ text: prompt }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
        responseSchema: GOVERNING_DOC_SCHEMA as unknown,
      },
    });

    const parsed = parseJsonWithRepair(response.text || '');
    if (!parsed.success || !parsed.data || typeof parsed.data !== 'object') {
      return fallbackSpec;
    }

    const data = parsed.data as Record<string, any>;
    const rawCoverages = Array.isArray(data.requiredCoverages) ? data.requiredCoverages : [];

    return {
      documentName: docNames,
      stage:
        requestedStage !== 'AUTO'
          ? requestedStage
          : normalizeStage(data.detectedStage as string | undefined, 'AUTO'),
      legalRegime: typeof data.legalRegime === 'string' ? data.legalRegime : null,
      processOrContractNumber:
        typeof data.processOrContractNumber === 'string' ? data.processOrContractNumber : null,
      entityName: typeof data.entityName === 'string' ? data.entityName : null,
      contractorName: typeof data.contractorName === 'string' ? data.contractorName : null,
      contractOrBudgetValue:
        typeof data.contractOrBudgetValue === 'number' ? data.contractOrBudgetValue : null,
      contractDuration: typeof data.contractDuration === 'string' ? data.contractDuration : null,
      requiredCoverages: rawCoverages
        .filter((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0)
        .map((c: any) => ({
          name: String(c.name).trim(),
          canonicalName: typeof c.canonicalName === 'string' ? c.canonicalName : null,
          percentageOfContract:
            typeof c.percentageOfContract === 'string' ? c.percentageOfContract : null,
          minimumAmount: typeof c.minimumAmount === 'number' ? c.minimumAmount : null,
          validityRule: typeof c.validityRule === 'string' ? c.validityRule : null,
          isMandatory: c.isMandatory !== false,
          notes: typeof c.notes === 'string' ? c.notes : null,
          rawTextSnippet: typeof c.rawTextSnippet === 'string' ? c.rawTextSnippet : null,
          pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : null,
        })),
    };
  } catch {
    return fallbackSpec;
  }
}

/**
 * Convert a GoverningDocumentSpec into a synthetic ParsedQuote so it can be
 * prepended as the leading reference column ("Exigido en Pliego / Contrato")
 * in the unified comparison matrix.
 */
export function buildGoverningReferenceQuote(spec: GoverningDocumentSpec): ParsedQuote {
  return {
    insurerName:
      spec.stage === 'LICITACION'
        ? 'Pliego de Licitación'
        : spec.stage === 'OTROSI'
          ? 'Otrosí Modificatorio'
          : 'Contrato / Pliego Rector',
    policyName: spec.processOrContractNumber || spec.documentName,
    priceAnnual: spec.contractOrBudgetValue ?? 0,
    currency: 'COP',
    coverages: spec.requiredCoverages.map((req) => ({
      name: req.name,
      canonicalName: req.canonicalName || req.name,
      value:
        req.minimumAmount && req.minimumAmount > 0
          ? String(req.minimumAmount)
          : req.percentageOfContract || 'Exigido',
      deductible: req.validityRule ? `Vigencia exigida: ${req.validityRule}` : 'Sin deducible',
      percentageOfContract: req.percentageOfContract ?? null,
      coverageValidity: req.validityRule ?? null,
      confidence: 100,
      rawTextSnippet: req.rawTextSnippet ?? undefined,
      calculatedPage: req.pageNumber ?? undefined,
    })),
    specialConditions: [],
    rawText: '',
    parseConfidence: 100,
    cumplimientoDetails: {
      contractStage: spec.stage,
      legalRegime: spec.legalRegime ?? null,
      processOrContractNumber: spec.processOrContractNumber ?? null,
      afianzadoName: spec.contractorName ?? null,
      beneficiaryName: spec.entityName ?? null,
      contractOrBudgetValue: spec.contractOrBudgetValue ?? null,
      contractDuration: spec.contractDuration ?? null,
    },
  };
}

/**
 * Deterministic gap analysis comparing each insurer quote against the extracted
 * requirements of the Governing Document (Pliego / Minuta del Contrato / Otrosí).
 */
export function auditQuotesAgainstGoverningSpec(
  quotes: Array<{
    insurerName: string;
    coverages?: Array<{
      name: string;
      canonicalName?: string;
      value?: string;
      percentageOfContract?: string | null;
      coverageValidity?: string | null;
      isPositive?: boolean;
    }>;
  }>,
  spec: GoverningDocumentSpec
): GoverningDocumentAudit {
  const perInsurerStatus: GoverningDocumentAudit['perInsurerStatus'] = {};
  const required = spec.requiredCoverages;

  for (const quote of quotes) {
    const gaps: CumplimientoGoverningGap[] = [];
    let compliantCount = 0;

    for (const req of required) {
      const reqNorm = normalizeLabel(req.canonicalName || req.name);
      const reqTokens = reqNorm.split(/\s+/).filter((t) => t.length >= 4);

      const matched = (quote.coverages || []).find((cov) => {
        const covNorm = normalizeLabel(`${cov.canonicalName || ''} ${cov.name || ''}`);
        const valNorm = normalizeLabel(cov.value || '');
        const isIncluded =
          cov.isPositive !== false &&
          valNorm.length > 0 &&
          !['no incluido', 'no incluida', 'no informado', 'excluido', 'no cubre'].includes(valNorm);
        if (!isIncluded) return false;
        if (covNorm.includes(reqNorm) || reqNorm.includes(covNorm)) return true;
        return reqTokens.some((tok) => covNorm.includes(tok));
      });

      const reqAmountStr =
        req.minimumAmount && req.minimumAmount > 0
          ? `$${req.minimumAmount.toLocaleString('es-CO')}`
          : null;

      if (!matched) {
        gaps.push({
          coverageName: req.name,
          requiredPercentage: req.percentageOfContract ?? null,
          requiredAmount: reqAmountStr,
          requiredValidity: req.validityRule ?? null,
          status: 'MISSING',
          quotedValue: null,
          notes: `Amparo exigido en ${spec.documentName} pero no detectado en la cotización de ${quote.insurerName}.`,
        });
        continue;
      }

      const reasons: string[] = [];
      const reqPct = extractNumericPercentage(req.percentageOfContract);
      const covPct =
        extractNumericPercentage(matched.percentageOfContract) ??
        extractNumericPercentage(matched.value);

      if (reqPct !== null && covPct !== null && covPct + 0.01 < reqPct) {
        reasons.push(`% cotizado (${covPct}%) inferior al exigido (${reqPct}%)`);
      }

      const covAmount = extractNumericCOP(matched.value);
      if (
        req.minimumAmount &&
        req.minimumAmount > 0 &&
        covAmount !== null &&
        covAmount + 1 < req.minimumAmount
      ) {
        reasons.push(
          `Suma cotizada ($${covAmount.toLocaleString('es-CO')}) menor a la mínima exigida (${reqAmountStr})`
        );
      }

      const reqYears = parseValidityYears(req.validityRule);
      const covYears = parseValidityYears(matched.coverageValidity);
      if (reqYears !== null && covYears !== null && covYears + 0.05 < reqYears) {
        reasons.push(
          `Vigencia cotizada (${matched.coverageValidity}) inferior a ${req.validityRule}`
        );
      }

      if (reasons.length > 0) {
        gaps.push({
          coverageName: req.name,
          requiredPercentage: req.percentageOfContract ?? null,
          requiredAmount: reqAmountStr,
          requiredValidity: req.validityRule ?? null,
          status: 'PARTIAL_GAP',
          quotedValue: matched.value ?? null,
          notes: reasons.join('; '),
        });
      } else {
        compliantCount++;
        gaps.push({
          coverageName: req.name,
          requiredPercentage: req.percentageOfContract ?? null,
          requiredAmount: reqAmountStr,
          requiredValidity: req.validityRule ?? null,
          status: 'COMPLIANT',
          quotedValue: matched.value ?? null,
          notes: 'Cumple con los parámetros exigidos en el Documento Rector.',
        });
      }
    }

    perInsurerStatus[quote.insurerName] = {
      compliantCount,
      totalRequired: required.length,
      gaps,
    };
  }

  return {
    documentName: spec.documentName,
    stage: spec.stage,
    legalRegime: spec.legalRegime ?? null,
    processOrContractNumber: spec.processOrContractNumber ?? null,
    entityName: spec.entityName ?? null,
    contractorName: spec.contractorName ?? null,
    contractOrBudgetValue: spec.contractOrBudgetValue ?? null,
    contractDuration: spec.contractDuration ?? null,
    requiredCoverages: required.map((r) => ({
      name: r.name,
      percentageOfContract: r.percentageOfContract ?? null,
      minimumAmount: r.minimumAmount ?? null,
      validityRule: r.validityRule ?? null,
    })),
    perInsurerStatus,
  };
}

export function resolveCumplimientoStage(rawStage: unknown): CumplimientoProcessStage {
  const s = String(rawStage || 'AUTO').toUpperCase();
  if (s === 'LICITACION' || s === 'CONTRATO' || s === 'OTROSI') {
    return s;
  }
  return 'AUTO';
}

export async function prepareGoverningReferenceContext(
  governingFiles: Array<{ path?: string }>,
  requestedStage: CumplimientoProcessStage
): Promise<{ spec?: GoverningDocumentSpec; referenceQuote?: ParsedQuote }> {
  const govPaths = governingFiles
    .map((f) => f.path)
    .filter((p): p is string => Boolean(p && fs.existsSync(p)));
  if (govPaths.length === 0) return {};

  const spec = await extractGoverningRequirements(govPaths, requestedStage);
  const referenceQuote =
    spec.requiredCoverages.length > 0 ? buildGoverningReferenceQuote(spec) : undefined;
  return { spec, referenceQuote };
}

export async function buildCumplimientoContext(
  domain: string,
  governingFiles: Array<{ path?: string }>,
  rawStage: unknown
): Promise<{
  cumplimientoStage: CumplimientoProcessStage;
  governingSpec?: GoverningDocumentSpec;
  governingReferenceQuote?: ParsedQuote;
}> {
  const cumplimientoStage = resolveCumplimientoStage(rawStage);
  if (domain !== 'cumplimiento' || governingFiles.length === 0) {
    return { cumplimientoStage };
  }
  const { spec, referenceQuote } = await prepareGoverningReferenceContext(
    governingFiles,
    cumplimientoStage
  );
  return {
    cumplimientoStage,
    governingSpec: spec,
    governingReferenceQuote: referenceQuote,
  };
}

export function applyCumplimientoPostProcessing(
  comparisonResult: {
    cumplimientoStage?: CumplimientoProcessStage;
    governingAudit?: GoverningDocumentAudit;
    quotes?: Array<RegulatoryAuditableQuote>;
    regulatoryBacking?: { perQuoteCompliance: Record<string, RegulatoryCheckResult[]> };
  },
  requestedStage: CumplimientoProcessStage,
  governingSpec?: GoverningDocumentSpec
): void {
  comparisonResult.cumplimientoStage = governingSpec?.stage ?? requestedStage;
  if (governingSpec && comparisonResult.quotes) {
    comparisonResult.governingAudit = auditQuotesAgainstGoverningSpec(
      comparisonResult.quotes,
      governingSpec
    );
  }
  const resolvedStage = comparisonResult.cumplimientoStage || requestedStage;
  if (resolvedStage !== 'AUTO' && comparisonResult.quotes && comparisonResult.regulatoryBacking) {
    const stageHint =
      resolvedStage === 'LICITACION' ? 'PRECONTRACTUAL_LICITACION' : 'CONTRACTUAL_EJECUCION';
    const stageQuotes = comparisonResult.quotes.map((q) => ({
      ...q,
      cumplimientoDetails: { contractStage: stageHint },
    }));
    comparisonResult.regulatoryBacking.perQuoteCompliance = auditReportCompliance(
      stageQuotes,
      'cumplimiento'
    );
  }
}

export const DEFAULT_RCE_ADDITIONAL_COVERAGES: ReadonlyArray<{
  code: string;
  label: string;
}> = [
  { code: 'CONTRATISTAS_SUBCONTRATISTAS', label: 'Contratistas y Subcontratistas' },
  { code: 'VEHICULOS_PROPIOS_NO_PROPIOS', label: 'Vehículos Propios y No Propios' },
  { code: 'RC_CRUZADA', label: 'RC Cruzada' },
  { code: 'RC_PATRONAL', label: 'RC Patronal' },
  { code: 'GASTOS_MEDICOS', label: 'Gastos Médicos' },
  {
    code: 'EXTRAPATRIMONIALES',
    label: 'Amparos Extrapatrimoniales (Daño Moral / Fisiológico)',
  },
  { code: 'LUCRO_CESANTE', label: 'Lucro Cesante (Perjuicios Patrimoniales)' },
];

const PREPOLICY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    caseType: { type: Type.STRING, description: 'LICITACION | CONTRATO | OTROSI' },
    legalRegime: {
      type: Type.STRING,
      description: 'ESTATAL_LEY_80 | PARTICULAR | REGIMEN_ESPECIAL',
    },
    contractType: {
      type: Type.STRING,
      description:
        'PRESTACION_SERVICIOS | OBRA | SUMINISTRO | ORDEN_DE_COMPRA | ORDEN_DE_SERVICIO | CONVENIO | LICITACION | OTRO',
    },
    contractNumber: { type: Type.STRING, nullable: true },
    secopProcessNumber: { type: Type.STRING, nullable: true },
    objectDescription: { type: Type.STRING, nullable: true },
    contractValue: { type: Type.NUMBER, nullable: true },
    includesIva: { type: Type.BOOLEAN, nullable: true },
    advancePaymentPercent: { type: Type.NUMBER, nullable: true },
    advancePaymentAmount: { type: Type.NUMBER, nullable: true },
    contractDuration: { type: Type.STRING, nullable: true },
    durationValue: { type: Type.NUMBER, nullable: true },
    durationUnit: {
      type: Type.STRING,
      description: 'DIAS_HABILES | DIAS_CALENDARIO | MESES | ANIOS',
      nullable: true,
    },
    contractSignatureDate: {
      type: Type.STRING,
      description: 'Fecha de firma YYYY-MM-DD si aparece en el documento',
      nullable: true,
    },
    contractStartDate: { type: Type.STRING, description: 'YYYY-MM-DD', nullable: true },
    contractEndDate: { type: Type.STRING, description: 'YYYY-MM-DD', nullable: true },
    liquidationTerm: { type: Type.STRING, nullable: true },
    paymentTerms: { type: Type.STRING, nullable: true },
    penalClause: { type: Type.STRING, nullable: true },
    finesClause: { type: Type.STRING, nullable: true },
    contractor: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, nullable: true },
        nit: { type: Type.STRING, nullable: true },
        personType: { type: Type.STRING, nullable: true },
        address: { type: Type.STRING, nullable: true },
        phone: { type: Type.STRING, nullable: true },
        city: { type: Type.STRING, nullable: true },
        contactName: { type: Type.STRING, nullable: true },
        contactEmail: { type: Type.STRING, nullable: true },
        contactPhone: { type: Type.STRING, nullable: true },
        ciiuCode: { type: Type.STRING, nullable: true },
        consortiumMembers: {
          type: Type.ARRAY,
          nullable: true,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              nit: { type: Type.STRING },
              participationPercent: { type: Type.NUMBER },
            },
            required: ['name'],
          },
        },
      },
      required: ['name', 'nit', 'personType'],
    },
    beneficiary: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, nullable: true },
        nit: { type: Type.STRING, nullable: true },
        address: { type: Type.STRING, nullable: true },
        phone: { type: Type.STRING, nullable: true },
        city: { type: Type.STRING, nullable: true },
      },
      required: ['name', 'nit'],
    },
    requiredCoverages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          canonicalName: { type: Type.STRING, nullable: true },
          phase: {
            type: Type.STRING,
            description: 'PRECONTRACTUAL | CONTRACTUAL | POST_CONTRACTUAL',
            nullable: true,
          },
          percentageOfContract: { type: Type.STRING, nullable: true },
          minimumAmount: { type: Type.NUMBER, nullable: true },
          baseValidity: { type: Type.STRING, nullable: true },
          additionalValidity: { type: Type.STRING, nullable: true },
          additionalTermValue: { type: Type.NUMBER, nullable: true },
          additionalTermUnit: {
            type: Type.STRING,
            description: 'DIAS_HABILES | DIAS_CALENDARIO | MESES | ANIOS',
            nullable: true,
          },
          validityRule: { type: Type.STRING, nullable: true },
          estimatedStartDate: { type: Type.STRING, nullable: true },
          estimatedEndDate: { type: Type.STRING, nullable: true },
          isMandatory: { type: Type.BOOLEAN, nullable: true },
          notes: { type: Type.STRING, nullable: true },
          rawTextSnippet: { type: Type.STRING, nullable: true },
          pageNumber: { type: Type.NUMBER, nullable: true },
        },
        required: ['name'],
      },
    },
    rceRequirement: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        required: { type: Type.BOOLEAN },
        basicPloIncluded: { type: Type.BOOLEAN, nullable: true },
        amountDescription: { type: Type.STRING, nullable: true },
        amountCop: { type: Type.NUMBER, nullable: true },
        amountSmmlv: { type: Type.NUMBER, nullable: true },
        subcoverages: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        additionalCoverages: {
          type: Type.ARRAY,
          nullable: true,
          items: {
            type: Type.OBJECT,
            properties: {
              code: { type: Type.STRING },
              label: { type: Type.STRING },
              included: { type: Type.BOOLEAN },
              sublimitSmmlv: { type: Type.NUMBER, nullable: true },
              notes: { type: Type.STRING, nullable: true },
            },
            required: ['code', 'included'],
          },
        },
        maxDeductibleRule: { type: Type.STRING, nullable: true },
        validityRule: { type: Type.STRING, nullable: true },
      },
    },
    modificationDetails: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        modificationType: { type: Type.STRING },
        basePolicyNumber: { type: Type.STRING, nullable: true },
        addedValue: { type: Type.NUMBER, nullable: true },
        newTotalContractValue: { type: Type.NUMBER, nullable: true },
        newEndDate: { type: Type.STRING, nullable: true },
        extensionTerm: { type: Type.STRING, nullable: true },
        justification: { type: Type.STRING, nullable: true },
      },
    },
    specialObservations: { type: Type.STRING, nullable: true },
  },
  required: [
    'caseType',
    'legalRegime',
    'contractType',
    'contractNumber',
    'objectDescription',
    'contractValue',
    'contractDuration',
    'contractor',
    'beneficiary',
    'requiredCoverages',
  ],
};

function normalizeCaseType(
  raw?: string | null,
  fallback: CumplimientoCaseType = 'CONTRATO'
): CumplimientoCaseType {
  const s = (raw || '').toUpperCase();
  if (s.includes('LICIT') || s.includes('PLIEGO')) return 'LICITACION';
  if (s.includes('OTROSI') || s.includes('MODIFIC') || s.includes('ADICION')) return 'OTROSI';
  if (s.includes('CONTRAT') || s.includes('ORDEN') || s.includes('MINUTA')) return 'CONTRATO';
  return fallback;
}

function normalizeLegalRegime(raw?: string | null): CumplimientoLegalRegime {
  const s = (raw || '').toUpperCase();
  if (s.includes('80') || s.includes('1082') || s.includes('ESTATAL') || s.includes('PUBLIC')) {
    return 'ESTATAL_LEY_80';
  }
  if (s.includes('ESPECIAL')) return 'REGIMEN_ESPECIAL';
  return 'PARTICULAR';
}

function normalizeContractType(raw?: string | null): CumplimientoContractType {
  const s = (raw || '').toUpperCase();
  if (s.includes('OBRA')) return 'OBRA';
  if (s.includes('SUMINIST')) return 'SUMINISTRO';
  if (s.includes('COMPRA')) return 'ORDEN_DE_COMPRA';
  if (s.includes('ORDEN') && s.includes('SERVIC')) return 'ORDEN_DE_SERVICIO';
  if (s.includes('CONVEN')) return 'CONVENIO';
  if (s.includes('LICIT')) return 'LICITACION';
  if (s.includes('SERVIC') || s.includes('PRESTAC')) return 'PRESTACION_SERVICIOS';
  return 'OTRO';
}

function normalizePersonType(
  raw?: string | null,
  nameHint?: string | null
): CumplimientoPersonType {
  const s = `${raw || ''} ${nameHint || ''}`.toUpperCase();
  if (s.includes('CONSORC')) return 'CONSORCIO';
  if (s.includes('UNION TEMPORAL') || s.includes('UNIÓN TEMPORAL') || /\bU\.?T\.?\b/.test(s)) {
    return 'UNION_TEMPORAL';
  }
  if (s.includes('NATURAL')) return 'NATURAL';
  return 'JURIDICA';
}

function normalizeDurationUnit(raw?: unknown, textHint?: string): ContractDurationUnit | null {
  const s = String(raw || textHint || '').toUpperCase();
  if (!s) return null;
  if (s.includes('HABIL') || s.includes('HÁBIL')) return 'DIAS_HABILES';
  if (s.includes('CALEND') || s.includes('CORRID') || s.includes('DIA') || s.includes('DÍA')) {
    return 'DIAS_CALENDARIO';
  }
  if (s.includes('MES')) return 'MESES';
  if (s.includes('ANO') || s.includes('AÑO') || s.includes('ANIO')) return 'ANIOS';
  return null;
}

function inferCoveragePhase(name: string, rawPhase?: unknown): CumplimientoCoveragePhase {
  const explicit = String(rawPhase || '').toUpperCase();
  if (explicit === 'PRECONTRACTUAL') return 'PRECONTRACTUAL';
  if (explicit === 'POST_CONTRACTUAL') return 'POST_CONTRACTUAL';
  if (explicit === 'CONTRACTUAL') return 'CONTRACTUAL';
  const norm = normalizeLabel(name);
  if (norm.includes('seriedad')) return 'PRECONTRACTUAL';
  if (norm.includes('estabilidad') || norm.includes('post')) return 'POST_CONTRACTUAL';
  return 'CONTRACTUAL';
}

function ensureQualityContractualAndPostSplit(
  coverages: CumplimientoRequiredCoverageItem[],
  contractStartIso: string,
  contractEndIso: string,
  includeSaturdays: boolean
): CumplimientoRequiredCoverageItem[] {
  const hasContractualQuality = coverages.some((c) => {
    const n = normalizeLabel(c.name);
    return n.includes('calidad') && c.phase === 'CONTRACTUAL';
  });
  const hasPostQuality = coverages.some((c) => {
    const n = normalizeLabel(c.name);
    return n.includes('calidad') && c.phase === 'POST_CONTRACTUAL';
  });

  const hasBothQualityPhases = hasContractualQuality && hasPostQuality;

  const out: CumplimientoRequiredCoverageItem[] = [];
  for (const cov of coverages) {
    const norm = normalizeLabel(cov.name);
    const isQuality =
      norm.includes('calidad del bien') ||
      norm.includes('calidad del servicio') ||
      norm.includes('calidad y correcto funcionamiento');

    if (isQuality && !hasBothQualityPhases) {
      const contractualDates = computeCoverageValidityDates(
        contractStartIso,
        contractEndIso,
        { phase: 'CONTRACTUAL' },
        includeSaturdays
      );
      const postDates = computeCoverageValidityDates(
        contractStartIso,
        contractEndIso,
        {
          phase: 'POST_CONTRACTUAL',
          additionalTermValue: cov.additionalTermValue,
          additionalTermUnit: cov.additionalTermUnit,
          validityRule: cov.validityRule,
        },
        includeSaturdays
      );
      out.push({
        ...cov,
        id: `${cov.id}-contractual`,
        name: `${cov.name} (Contractual)`,
        phase: 'CONTRACTUAL',
        estimatedStartDate: contractualDates.startDate,
        estimatedEndDate: contractualDates.endDate,
      });
      out.push({
        ...cov,
        id: `${cov.id}-post`,
        name: `${cov.name} (Post-contractual)`,
        phase: 'POST_CONTRACTUAL',
        estimatedStartDate: postDates.startDate,
        estimatedEndDate: postDates.endDate,
      });
      continue;
    }

    const dates = computeCoverageValidityDates(
      contractStartIso,
      contractEndIso,
      cov,
      includeSaturdays
    );
    out.push({
      ...cov,
      estimatedStartDate: cov.estimatedStartDate || dates.startDate,
      estimatedEndDate: cov.estimatedEndDate || dates.endDate,
    });
  }
  return out;
}

function buildNormalizedRce(
  rawRce: Record<string, unknown> | undefined,
  contractValueCop: number | null,
  contractStartIso: string,
  contractEndIso: string
) {
  const smmlv = COLOMBIA_SMMLV_2026;
  const suggestedMinSmmlv = calculateDecreto1082RceMinSmmlv(contractValueCop, smmlv);
  if (!rawRce) {
    return {
      required: false,
      basicPloIncluded: false,
      suggestedMinSmmlv,
      subcoverages: [],
      additionalCoverages: DEFAULT_RCE_ADDITIONAL_COVERAGES.map((d) => ({
        code: d.code,
        label: d.label,
        included: false,
      })),
    };
  }

  const rawAdds = Array.isArray(rawRce.additionalCoverages)
    ? (rawRce.additionalCoverages as Array<Record<string, unknown>>)
    : [];
  const rawSubStrings = Array.isArray(rawRce.subcoverages)
    ? (rawRce.subcoverages as unknown[]).map((s) => sanitizeForPostgres(String(s)))
    : [];

  const additionalCoverages: CumplimientoRceAdditionalCoverage[] =
    DEFAULT_RCE_ADDITIONAL_COVERAGES.map((def) => {
      const found = rawAdds.find(
        (a) =>
          String(a.code || '').toUpperCase() === def.code ||
          normalizeLabel(String(a.label || '')).includes(normalizeLabel(def.label.split(' ')[0]!))
      );
      const matchedText = rawSubStrings.some((s) =>
        normalizeLabel(s).includes(normalizeLabel(def.label.split(' ')[0]!))
      );
      const sublimitSmmlv = typeof found?.sublimitSmmlv === 'number' ? found.sublimitSmmlv : null;
      return {
        code: def.code,
        label: def.label,
        included: Boolean(found?.included ?? matchedText),
        sublimitSmmlv,
        sublimitCop: sublimitSmmlv !== null ? Math.round(sublimitSmmlv * smmlv) : null,
        notes: typeof found?.notes === 'string' ? sanitizeForPostgres(found.notes) : null,
      };
    });

  let amountSmmlv = typeof rawRce.amountSmmlv === 'number' ? rawRce.amountSmmlv : null;
  let amountCop = parseCopField(rawRce.amountCop);
  if (amountSmmlv === null && amountCop !== null && amountCop > 0) {
    amountSmmlv = Math.round((amountCop / smmlv) * 100) / 100;
  } else if (amountCop === null && amountSmmlv !== null && amountSmmlv > 0) {
    amountCop = Math.round(amountSmmlv * smmlv);
  }

  return {
    required: Boolean(rawRce.required),
    basicPloIncluded: rawRce.basicPloIncluded !== false,
    amountDescription:
      typeof rawRce.amountDescription === 'string'
        ? sanitizeForPostgres(rawRce.amountDescription)
        : null,
    amountCop,
    amountSmmlv,
    suggestedMinSmmlv,
    subcoverages: rawSubStrings,
    additionalCoverages,
    maxDeductibleRule:
      typeof rawRce.maxDeductibleRule === 'string'
        ? sanitizeForPostgres(rawRce.maxDeductibleRule)
        : null,
    validityRule:
      typeof rawRce.validityRule === 'string' ? sanitizeForPostgres(rawRce.validityRule) : null,
    startDate: contractStartIso,
    endDate: contractEndIso,
  };
}

const MAX_PREPOLICY_TEXT_CHARS = 220000;

function boundDocumentText(fullText: string, maxChars = MAX_PREPOLICY_TEXT_CHARS): string {
  if (fullText.length <= maxChars) return fullText;
  const headChars = Math.floor(maxChars * 0.6);
  const tailChars = maxChars - headChars;
  return `${fullText.slice(0, headChars)}\n\n[... SECCIÓN INTERMEDIA OMITIDA POR LONGITUD ...]\n\n${fullText.slice(-tailChars)}`;
}

function parseCopField(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') return extractNumericCOP(raw);
  return null;
}

function extractCopFromSnippet(snippet?: string | null): number | null {
  if (!snippet) return null;
  const match = snippet.match(/(?:\$|COP)\s*([\d.,]{4,})/i);
  return match ? extractNumericCOP(match[1]) : null;
}

/**
 * Extracts a full editable Pre-policy (Slip) structure from one or more Governing Documents
 * (Contrato, Pliego de Condiciones, Minuta, Orden de Compra/Servicio, or Otrosí).
 */
export async function extractPrepolicyFromDocuments(
  files: Array<{ path: string; originalname: string }>,
  requestedType: CumplimientoCaseType = 'CONTRATO',
  parentPrepolicy?: CumplimientoPrepolicyData | null
): Promise<CumplimientoPrepolicyData> {
  const texts: string[] = [];
  for (const file of files) {
    try {
      const res = await pdfExtractor.extractTextFromPdf(file.path);
      if (res?.text) {
        texts.push(`=== DOCUMENTO: ${file.originalname} ===\n${sanitizeForPostgres(res.text)}`);
      }
    } catch (err) {
      console.warn(`[GoverningDocExtractor] Failed to extract ${file.originalname}:`, err);
    }
  }

  const combinedText = boundDocumentText(texts.join('\n\n'));
  let extracted: Record<string, unknown> = {};

  if (combinedText && env.GEMINI_API_KEY) {
    try {
      const genAI = getGenAI();
      const parentHint = parentPrepolicy
        ? `\nCONTEXTO DEL CASO BASE (es un OTROSÍ / modificación):\n- Contrato #: ${parentPrepolicy.contractNumber}\n- Valor anterior: ${parentPrepolicy.contractValue}\n- Tomador: ${parentPrepolicy.contractor.name} (${parentPrepolicy.contractor.nit})\n- Beneficiario: ${parentPrepolicy.beneficiary.name} (${parentPrepolicy.beneficiary.nit})\n`
        : '';

      const prompt = `Eres un suscriptor técnico senior de Cumplimiento y Fianzas en Colombia (Ley 80 / Decreto 1082 de 2015 y régimen privado).
Lee COMPLETAMENTE el documento rector (encabezado, comparecencia de las partes, cláusulas de objeto, valor, forma de pago, plazo/vigencia y la tabla COMPLETA de garantías/pólizas) y extrae TODOS los datos para generar la Pre-póliza / Slip de solicitud de cotización:
1. Tomador / Contratista: razón social o nombre completo, NIT/CC exacto, tipo (NATURAL, JURIDICA, CONSORCIO, UNION_TEMPORAL), dirección, teléfono, ciudad, contacto y miembros del consorcio/UT con % de participación si aplica.
2. Asegurado / Beneficiario (Contratante): nombre exacto de la entidad/empresa que contrata, NIT exacto, dirección, teléfono, ciudad, y régimen (ESTATAL_LEY_80 si es entidad pública/SECOP/Ley 80/Decreto 1082, REGIMEN_ESPECIAL, o PARTICULAR).
3. Contrato / Proceso: tipo (PRESTACION_SERVICIOS, OBRA, SUMINISTRO, ORDEN_DE_COMPRA, ORDEN_DE_SERVICIO, CONVENIO, LICITACION, OTRO), número exacto del contrato (ej. OC-001-2026) y proceso SECOP, objeto contractual completo, valor total del contrato como NÚMERO entero en COP (sin puntos ni $), si incluye IVA, anticipo (% y valor numérico), duración textual, durationValue numérico, durationUnit (DIAS_HABILES si dice días hábiles, DIAS_CALENDARIO si dice días calendario/corridos, MESES o ANIOS), contractSignatureDate (YYYY-MM-DD si aparece fecha de firma), contractStartDate y contractEndDate (YYYY-MM-DD si son expresas).
4. Garantías de Cumplimiento: extrae CADA UNO de los amparos de la tabla de garantías (Seriedad de la Oferta, Buen Manejo del Anticipo, Pago Anticipado, Cumplimiento, Pago de Salarios y Prestaciones Sociales, Calidad del Bien, Calidad del Servicio, Estabilidad de la Obra) indicando phase (CONTRACTUAL o POST_CONTRACTUAL), percentageOfContract, minimumAmount como NÚMERO entero en COP (sin puntos ni $), additionalTermValue, additionalTermUnit y validityRule completa.
5. RCE Derivada (LEER DE MANERA INDEPENDIENTE): si el documento exige póliza de Responsabilidad Civil Extracontractual derivada, extrae amountSmmlv (en SMMLV de 2026: $1.750.905 COP), amountCop, basicPloIncluded (Predios, Labores y Operaciones - PLO), maxDeductibleRule, validityRule, y marca en additionalCoverages cuáles de estos 7 amparos adicionales exige el contrato: CONTRATISTAS_SUBCONTRATISTAS, VEHICULOS_PROPIOS_NO_PROPIOS, RC_CRUZADA, RC_PATRONAL, GASTOS_MEDICOS, EXTRAPATRIMONIALES, LUCRO_CESANTE.
6. Otrosí / Modificación (si aplica): tipo (ADICION, PRORROGA, ACLARACION, SUSPENSION, CESION), valor adicionado, nuevo valor total, nueva fecha fin.
No dejes campos vacíos si la información aparece en cualquier página del documento.
${parentHint}
DOCUMENTO(S):
${combinedText}`;

      const response = await genAI.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.05,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: PREPOLICY_SCHEMA,
        },
      });
      const repairResult = parseJsonWithRepair(response.text || '{}');
      if (repairResult.success && repairResult.data && typeof repairResult.data === 'object') {
        extracted = repairResult.data as Record<string, unknown>;
      }
    } catch (error) {
      console.warn('[GoverningDocExtractor] Gemini prepolicy extraction fallback:', error);
    }
  }

  const rawContractor = (extracted.contractor as Record<string, unknown> | undefined) || {};
  const rawBeneficiary = (extracted.beneficiary as Record<string, unknown> | undefined) || {};
  const contractValue =
    parseCopField(extracted.contractValue) ?? parentPrepolicy?.contractValue ?? null;

  const rawCoverages = Array.isArray(extracted.requiredCoverages)
    ? (extracted.requiredCoverages as Array<Record<string, unknown>>)
    : [];

  const contractDuration = sanitizeForPostgres(
    String(extracted.contractDuration || parentPrepolicy?.contractDuration || '')
  );
  const durationValue =
    typeof extracted.durationValue === 'number'
      ? extracted.durationValue
      : (parentPrepolicy?.durationValue ?? null);
  const durationUnit =
    normalizeDurationUnit(extracted.durationUnit, contractDuration) ??
    parentPrepolicy?.durationUnit ??
    null;
  const contractSignatureDate =
    typeof extracted.contractSignatureDate === 'string'
      ? sanitizeForPostgres(extracted.contractSignatureDate)
      : (parentPrepolicy?.contractSignatureDate ?? null);
  const resolvedStart = resolveContractStartDate(
    typeof extracted.contractStartDate === 'string'
      ? sanitizeForPostgres(extracted.contractStartDate)
      : parentPrepolicy?.contractStartDate,
    contractSignatureDate
  );
  const explicitEndDate =
    typeof extracted.contractEndDate === 'string'
      ? sanitizeForPostgres(extracted.contractEndDate)
      : (parentPrepolicy?.contractEndDate ?? null);
  const computedEndDate =
    explicitEndDate ||
    (durationValue && durationUnit
      ? addContractTerm(resolvedStart.date, durationValue, durationUnit, false)
      : resolvedStart.date);

  const mappedCoverages: CumplimientoRequiredCoverageItem[] = rawCoverages.map((c, idx) => {
    const name = sanitizeForPostgres(String(c.name || `Amparo ${idx + 1}`));
    const pctStr =
      typeof c.percentageOfContract === 'string'
        ? sanitizeForPostgres(c.percentageOfContract)
        : null;
    const pctNum = extractNumericPercentage(pctStr);
    const snippet =
      typeof c.rawTextSnippet === 'string' ? sanitizeForPostgres(c.rawTextSnippet) : null;
    const minAmt =
      parseCopField(c.minimumAmount) ??
      extractCopFromSnippet(snippet) ??
      (pctNum !== null && contractValue !== null
        ? Math.round((contractValue * pctNum) / 100)
        : null);
    const validityRule =
      typeof c.validityRule === 'string' ? sanitizeForPostgres(c.validityRule) : null;
    const additionalTermValue =
      typeof c.additionalTermValue === 'number' ? c.additionalTermValue : null;
    const additionalTermUnit = normalizeDurationUnit(
      c.additionalTermUnit,
      typeof c.additionalValidity === 'string' ? c.additionalValidity : validityRule || ''
    );
    return {
      id: `cov-${idx + 1}`,
      name,
      canonicalName:
        typeof c.canonicalName === 'string' ? sanitizeForPostgres(c.canonicalName) : null,
      phase: inferCoveragePhase(name, c.phase),
      percentageOfContract: pctStr,
      percentageNumeric: pctNum,
      minimumAmount: minAmt,
      baseValidity: typeof c.baseValidity === 'string' ? sanitizeForPostgres(c.baseValidity) : null,
      additionalValidity:
        typeof c.additionalValidity === 'string' ? sanitizeForPostgres(c.additionalValidity) : null,
      additionalTermValue,
      additionalTermUnit,
      validityRule,
      estimatedStartDate:
        typeof c.estimatedStartDate === 'string' ? sanitizeForPostgres(c.estimatedStartDate) : null,
      estimatedEndDate:
        typeof c.estimatedEndDate === 'string' ? sanitizeForPostgres(c.estimatedEndDate) : null,
      isMandatory: c.isMandatory !== false,
      notes: typeof c.notes === 'string' ? sanitizeForPostgres(c.notes) : null,
      rawTextSnippet: snippet,
      pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : null,
    };
  });

  const requiredCoverages = ensureQualityContractualAndPostSplit(
    mappedCoverages,
    resolvedStart.date,
    computedEndDate,
    false
  );

  const contractorName = sanitizeForPostgres(
    String(rawContractor.name || parentPrepolicy?.contractor.name || '')
  );

  const prepolicy: CumplimientoPrepolicyData = {
    caseType: normalizeCaseType(
      typeof extracted.caseType === 'string' ? extracted.caseType : undefined,
      requestedType
    ),
    legalRegime: normalizeLegalRegime(
      typeof extracted.legalRegime === 'string'
        ? extracted.legalRegime
        : parentPrepolicy?.legalRegime
    ),
    contractType: normalizeContractType(
      typeof extracted.contractType === 'string'
        ? extracted.contractType
        : parentPrepolicy?.contractType
    ),
    contractNumber: sanitizeForPostgres(
      String(extracted.contractNumber || parentPrepolicy?.contractNumber || '')
    ),
    secopProcessNumber:
      typeof extracted.secopProcessNumber === 'string'
        ? sanitizeForPostgres(extracted.secopProcessNumber)
        : (parentPrepolicy?.secopProcessNumber ?? null),
    objectDescription: sanitizeForPostgres(
      String(extracted.objectDescription || parentPrepolicy?.objectDescription || '')
    ),
    contractValue,
    includesIva: typeof extracted.includesIva === 'boolean' ? extracted.includesIva : null,
    advancePaymentPercent:
      typeof extracted.advancePaymentPercent === 'number' ? extracted.advancePaymentPercent : null,
    advancePaymentAmount: parseCopField(extracted.advancePaymentAmount),
    contractDuration,
    durationValue,
    durationUnit,
    includeSaturdays: false,
    contractSignatureDate,
    contractStartDate: resolvedStart.date,
    contractStartDateSource: resolvedStart.source,
    contractEndDate: computedEndDate,
    displayCurrency: 'COP',
    smmlvValue: COLOMBIA_SMMLV_2026,
    liquidationTerm:
      typeof extracted.liquidationTerm === 'string'
        ? sanitizeForPostgres(extracted.liquidationTerm)
        : (parentPrepolicy?.liquidationTerm ?? null),
    paymentTerms:
      typeof extracted.paymentTerms === 'string'
        ? sanitizeForPostgres(extracted.paymentTerms)
        : null,
    penalClause:
      typeof extracted.penalClause === 'string' ? sanitizeForPostgres(extracted.penalClause) : null,
    finesClause:
      typeof extracted.finesClause === 'string' ? sanitizeForPostgres(extracted.finesClause) : null,
    contractor: {
      name: contractorName,
      nit: sanitizeForPostgres(String(rawContractor.nit || parentPrepolicy?.contractor.nit || '')),
      personType: normalizePersonType(
        typeof rawContractor.personType === 'string' ? rawContractor.personType : undefined,
        contractorName
      ),
      address:
        typeof rawContractor.address === 'string'
          ? sanitizeForPostgres(rawContractor.address)
          : (parentPrepolicy?.contractor.address ?? null),
      phone:
        typeof rawContractor.phone === 'string'
          ? sanitizeForPostgres(rawContractor.phone)
          : typeof rawContractor.contactPhone === 'string'
            ? sanitizeForPostgres(rawContractor.contactPhone)
            : (parentPrepolicy?.contractor.phone ?? null),
      city:
        typeof rawContractor.city === 'string'
          ? sanitizeForPostgres(rawContractor.city)
          : (parentPrepolicy?.contractor.city ?? null),
      contactName:
        typeof rawContractor.contactName === 'string'
          ? sanitizeForPostgres(rawContractor.contactName)
          : (parentPrepolicy?.contractor.contactName ?? null),
      contactEmail:
        typeof rawContractor.contactEmail === 'string'
          ? sanitizeForPostgres(rawContractor.contactEmail)
          : (parentPrepolicy?.contractor.contactEmail ?? null),
      contactPhone:
        typeof rawContractor.contactPhone === 'string'
          ? sanitizeForPostgres(rawContractor.contactPhone)
          : (parentPrepolicy?.contractor.contactPhone ?? null),
      ciiuCode:
        typeof rawContractor.ciiuCode === 'string'
          ? sanitizeForPostgres(rawContractor.ciiuCode)
          : null,
      consortiumMembers: Array.isArray(rawContractor.consortiumMembers)
        ? (rawContractor.consortiumMembers as Array<Record<string, unknown>>).map((m) => ({
            name: sanitizeForPostgres(String(m.name || '')),
            nit: sanitizeForPostgres(String(m.nit || '')),
            participationPercent:
              typeof m.participationPercent === 'number' ? m.participationPercent : 0,
          }))
        : (parentPrepolicy?.contractor.consortiumMembers ?? []),
    },
    beneficiary: {
      name: sanitizeForPostgres(
        String(rawBeneficiary.name || parentPrepolicy?.beneficiary.name || '')
      ),
      nit: sanitizeForPostgres(
        String(rawBeneficiary.nit || parentPrepolicy?.beneficiary.nit || '')
      ),
      address:
        typeof rawBeneficiary.address === 'string'
          ? sanitizeForPostgres(rawBeneficiary.address)
          : (parentPrepolicy?.beneficiary.address ?? null),
      phone:
        typeof rawBeneficiary.phone === 'string'
          ? sanitizeForPostgres(rawBeneficiary.phone)
          : (parentPrepolicy?.beneficiary.phone ?? null),
      city:
        typeof rawBeneficiary.city === 'string'
          ? sanitizeForPostgres(rawBeneficiary.city)
          : (parentPrepolicy?.beneficiary.city ?? null),
    },
    requiredCoverages,
    rceRequirement: buildNormalizedRce(
      extracted.rceRequirement as Record<string, unknown> | undefined,
      contractValue,
      resolvedStart.date,
      computedEndDate
    ),
    modificationDetails: extracted.modificationDetails
      ? {
          modificationType: (['ADICION', 'PRORROGA', 'ACLARACION', 'SUSPENSION', 'CESION'].includes(
            String(
              (extracted.modificationDetails as Record<string, unknown>).modificationType || ''
            ).toUpperCase()
          )
            ? String(
                (extracted.modificationDetails as Record<string, unknown>).modificationType
              ).toUpperCase()
            : 'ADICION') as 'ADICION' | 'PRORROGA' | 'ACLARACION' | 'SUSPENSION' | 'CESION',
          basePolicyNumber:
            typeof (extracted.modificationDetails as Record<string, unknown>).basePolicyNumber ===
            'string'
              ? sanitizeForPostgres(
                  String(
                    (extracted.modificationDetails as Record<string, unknown>).basePolicyNumber
                  )
                )
              : null,
          addedValue:
            typeof (extracted.modificationDetails as Record<string, unknown>).addedValue ===
            'number'
              ? ((extracted.modificationDetails as Record<string, unknown>).addedValue as number)
              : null,
          newTotalContractValue:
            typeof (extracted.modificationDetails as Record<string, unknown>)
              .newTotalContractValue === 'number'
              ? ((extracted.modificationDetails as Record<string, unknown>)
                  .newTotalContractValue as number)
              : null,
          newEndDate:
            typeof (extracted.modificationDetails as Record<string, unknown>).newEndDate ===
            'string'
              ? sanitizeForPostgres(
                  String((extracted.modificationDetails as Record<string, unknown>).newEndDate)
                )
              : null,
          extensionTerm:
            typeof (extracted.modificationDetails as Record<string, unknown>).extensionTerm ===
            'string'
              ? sanitizeForPostgres(
                  String((extracted.modificationDetails as Record<string, unknown>).extensionTerm)
                )
              : null,
          justification:
            typeof (extracted.modificationDetails as Record<string, unknown>).justification ===
            'string'
              ? sanitizeForPostgres(
                  String((extracted.modificationDetails as Record<string, unknown>).justification)
                )
              : null,
        }
      : null,
    decreto1082Alerts: [],
    specialObservations:
      typeof extracted.specialObservations === 'string'
        ? sanitizeForPostgres(extracted.specialObservations)
        : null,
  };

  prepolicy.decreto1082Alerts = evaluateDecreto1082Rules(prepolicy);
  console.log(
    `📋 [PrepolicyExtractor] chars=${combinedText.length}, contract=${prepolicy.contractNumber || 'N/A'}, contractor=${prepolicy.contractor.name || 'N/A'}, beneficiary=${prepolicy.beneficiary.name || 'N/A'}, value=${prepolicy.contractValue ?? 'null'}, coverages=${prepolicy.requiredCoverages.length}`
  );
  return prepolicy;
}
