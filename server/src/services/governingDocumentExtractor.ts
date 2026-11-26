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
import { evaluateDecreto1082Rules } from './cumplimientoAuditService';
import type {
  CumplimientoGoverningGap,
  CumplimientoProcessStage,
  GoverningDocumentAudit,
  RegulatoryCheckResult,
} from '../types';
import type {
  CumplimientoCaseType,
  CumplimientoContractType,
  CumplimientoLegalRegime,
  CumplimientoPersonType,
  CumplimientoPrepolicyData,
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
    contractStartDate: { type: Type.STRING, nullable: true },
    contractEndDate: { type: Type.STRING, nullable: true },
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
    },
    beneficiary: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, nullable: true },
        nit: { type: Type.STRING, nullable: true },
        address: { type: Type.STRING, nullable: true },
        city: { type: Type.STRING, nullable: true },
      },
    },
    requiredCoverages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          canonicalName: { type: Type.STRING, nullable: true },
          percentageOfContract: { type: Type.STRING, nullable: true },
          minimumAmount: { type: Type.NUMBER, nullable: true },
          baseValidity: { type: Type.STRING, nullable: true },
          additionalValidity: { type: Type.STRING, nullable: true },
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
        amountDescription: { type: Type.STRING, nullable: true },
        amountCop: { type: Type.NUMBER, nullable: true },
        amountSmmlv: { type: Type.NUMBER, nullable: true },
        subcoverages: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
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
  required: ['requiredCoverages'],
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

  const combinedText = texts.join('\n\n').slice(0, 65000);
  let extracted: Record<string, unknown> = {};

  if (combinedText && env.GEMINI_API_KEY) {
    try {
      const genAI = getGenAI();
      const parentHint = parentPrepolicy
        ? `\nCONTEXTO DEL CASO BASE (es un OTROSÍ / modificación):\n- Contrato #: ${parentPrepolicy.contractNumber}\n- Valor anterior: ${parentPrepolicy.contractValue}\n- Tomador: ${parentPrepolicy.contractor.name} (${parentPrepolicy.contractor.nit})\n- Beneficiario: ${parentPrepolicy.beneficiary.name} (${parentPrepolicy.beneficiary.nit})\n`
        : '';

      const prompt = `Eres un suscriptor técnico senior de Cumplimiento y Fianzas en Colombia (Ley 80 / Decreto 1082 de 2015 y régimen privado).
Extrae TODOS los datos necesarios del documento rector para generar una Pre-póliza / Slip de solicitud de cotización ante aseguradoras:
1. Tomador / Contratista: razón social, NIT/CC, tipo (NATURAL, JURIDICA, CONSORCIO, UNION_TEMPORAL), dirección, ciudad, contacto y miembros del consorcio/UT con % de participación si aplica.
2. Asegurado / Beneficiario (Contratante): nombre exacto de la entidad/empresa, NIT, dirección, ciudad, y régimen (ESTATAL_LEY_80 si es entidad pública/SECOP/Ley 80/Decreto 1082, REGIMEN_ESPECIAL, o PARTICULAR).
3. Contrato / Proceso: tipo (PRESTACION_SERVICIOS, OBRA, SUMINISTRO, ORDEN_DE_COMPRA, ORDEN_DE_SERVICIO, CONVENIO, LICITACION, OTRO), número de contrato y proceso SECOP, objeto contractual completo, valor del contrato (COP numérico), si incluye IVA, anticipo (% y valor), duración, fechas inicio/fin, plazo de liquidación, forma de pago, cláusula penal y multas.
4. Garantías y Amparos: todos los amparos exigidos (Seriedad, Cumplimiento, Anticipo, Salarios y Prestaciones, Calidad del Servicio, Calidad de Bienes, Estabilidad de Obra, etc.) con porcentajeOfContract, minimumAmount calculado en COP, baseValidity, additionalValidity (ej: "+ 3 años", "+ 4 meses liquidación", "5 años desde recibo final") y validityRule completa.
5. RCE Derivada: si se exige póliza de Responsabilidad Civil Extracontractual derivada, cuantía en COP y/o SMMLV, subamparos (PLO, Contratistas y Subcontratistas, Vehículos, Patronal, Cruzada) y deducible máximo.
6. Otrosí / Modificación (si aplica): tipo (ADICION, PRORROGA, ACLARACION, SUSPENSION, CESION), valor adicionado, nuevo valor total, nueva fecha fin.
${parentHint}
DOCUMENTO(S):
${combinedText}`;

      const response = await genAI.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: PREPOLICY_SCHEMA,
          temperature: 0.05,
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
    typeof extracted.contractValue === 'number'
      ? extracted.contractValue
      : (parentPrepolicy?.contractValue ?? null);

  const rawCoverages = Array.isArray(extracted.requiredCoverages)
    ? (extracted.requiredCoverages as Array<Record<string, unknown>>)
    : [];

  const requiredCoverages = rawCoverages.map((c, idx) => {
    const pctStr =
      typeof c.percentageOfContract === 'string'
        ? sanitizeForPostgres(c.percentageOfContract)
        : null;
    const pctNum = extractNumericPercentage(pctStr);
    const minAmt =
      typeof c.minimumAmount === 'number'
        ? c.minimumAmount
        : pctNum !== null && contractValue !== null
          ? Math.round((contractValue * pctNum) / 100)
          : null;
    return {
      id: `cov-${idx + 1}`,
      name: sanitizeForPostgres(String(c.name || `Amparo ${idx + 1}`)),
      canonicalName:
        typeof c.canonicalName === 'string' ? sanitizeForPostgres(c.canonicalName) : null,
      percentageOfContract: pctStr,
      percentageNumeric: pctNum,
      minimumAmount: minAmt,
      baseValidity: typeof c.baseValidity === 'string' ? sanitizeForPostgres(c.baseValidity) : null,
      additionalValidity:
        typeof c.additionalValidity === 'string' ? sanitizeForPostgres(c.additionalValidity) : null,
      validityRule: typeof c.validityRule === 'string' ? sanitizeForPostgres(c.validityRule) : null,
      estimatedStartDate:
        typeof c.estimatedStartDate === 'string' ? sanitizeForPostgres(c.estimatedStartDate) : null,
      estimatedEndDate:
        typeof c.estimatedEndDate === 'string' ? sanitizeForPostgres(c.estimatedEndDate) : null,
      isMandatory: c.isMandatory !== false,
      notes: typeof c.notes === 'string' ? sanitizeForPostgres(c.notes) : null,
      rawTextSnippet:
        typeof c.rawTextSnippet === 'string' ? sanitizeForPostgres(c.rawTextSnippet) : null,
      pageNumber: typeof c.pageNumber === 'number' ? c.pageNumber : null,
    };
  });

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
    advancePaymentAmount:
      typeof extracted.advancePaymentAmount === 'number' ? extracted.advancePaymentAmount : null,
    contractDuration: sanitizeForPostgres(
      String(extracted.contractDuration || parentPrepolicy?.contractDuration || '')
    ),
    contractStartDate:
      typeof extracted.contractStartDate === 'string'
        ? sanitizeForPostgres(extracted.contractStartDate)
        : (parentPrepolicy?.contractStartDate ?? null),
    contractEndDate:
      typeof extracted.contractEndDate === 'string'
        ? sanitizeForPostgres(extracted.contractEndDate)
        : (parentPrepolicy?.contractEndDate ?? null),
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
      city:
        typeof rawBeneficiary.city === 'string'
          ? sanitizeForPostgres(rawBeneficiary.city)
          : (parentPrepolicy?.beneficiary.city ?? null),
    },
    requiredCoverages,
    rceRequirement: extracted.rceRequirement
      ? {
          required: Boolean((extracted.rceRequirement as Record<string, unknown>).required),
          amountDescription:
            typeof (extracted.rceRequirement as Record<string, unknown>).amountDescription ===
            'string'
              ? sanitizeForPostgres(
                  String((extracted.rceRequirement as Record<string, unknown>).amountDescription)
                )
              : null,
          amountCop:
            typeof (extracted.rceRequirement as Record<string, unknown>).amountCop === 'number'
              ? ((extracted.rceRequirement as Record<string, unknown>).amountCop as number)
              : null,
          amountSmmlv:
            typeof (extracted.rceRequirement as Record<string, unknown>).amountSmmlv === 'number'
              ? ((extracted.rceRequirement as Record<string, unknown>).amountSmmlv as number)
              : null,
          subcoverages: Array.isArray(
            (extracted.rceRequirement as Record<string, unknown>).subcoverages
          )
            ? ((extracted.rceRequirement as Record<string, unknown>).subcoverages as unknown[]).map(
                (s) => sanitizeForPostgres(String(s))
              )
            : [],
          maxDeductibleRule:
            typeof (extracted.rceRequirement as Record<string, unknown>).maxDeductibleRule ===
            'string'
              ? sanitizeForPostgres(
                  String((extracted.rceRequirement as Record<string, unknown>).maxDeductibleRule)
                )
              : null,
          validityRule:
            typeof (extracted.rceRequirement as Record<string, unknown>).validityRule === 'string'
              ? sanitizeForPostgres(
                  String((extracted.rceRequirement as Record<string, unknown>).validityRule)
                )
              : null,
        }
      : { required: false, subcoverages: [] },
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
  return prepolicy;
}
