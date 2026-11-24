import fs from 'fs';
import path from 'path';
import { Type } from '@google/genai';
import { env } from '../config/env';
import { getGenAI } from './geminiClient';
import { parseJsonWithRepair } from './jsonRepair';
import { pdfExtractor } from './pdfExtractor';
import { ParsedQuote } from './quoteParser';
import { auditReportCompliance, type RegulatoryAuditableQuote } from './regulatoryAuditService';
import type {
  CumplimientoGoverningGap,
  CumplimientoProcessStage,
  GoverningDocumentAudit,
  RegulatoryCheckResult,
} from '../types';

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
