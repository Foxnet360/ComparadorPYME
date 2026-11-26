import crypto from 'crypto';
import { Type } from '@google/genai';
import { env } from '../config/env';
import { getGenAI } from './geminiClient';
import { parseJsonWithRepair } from './jsonRepair';
import { pdfExtractor } from './pdfExtractor';
import { sanitizeForPostgres } from '../utils/stringUtils';
import type {
  CumplimientoChecklistItem,
  CumplimientoDecreto1082Alert,
  CumplimientoFieldCheck,
  CumplimientoPrepolicyData,
  CumplimientoQuoteEconomicRow,
  CumplimientoValidationRecord,
  CumplimientoValidationTarget,
} from '../types/cumplimientoCase';

export interface CumplimientoExtractedQuote {
  fileName: string;
  insurerName: string;
  contractorName?: string | null;
  contractorNit?: string | null;
  beneficiaryName?: string | null;
  beneficiaryNit?: string | null;
  contractNumber?: string | null;
  objectDescription?: string | null;
  contractValue?: number | null;
  legalRegime?: string | null;
  premiumAnnual?: number | null;
  ratePercent?: number | null;
  minimumPremiumApplied?: boolean | null;
  paymentTerms?: string | null;
  counterGuarantee?: string | null;
  rceMaxDeductiblePercent?: number | null;
  rceAmountCop?: number | null;
  rceSubcoverages?: string[];
  coverages: Array<{
    name: string;
    percentageOfContract?: string | null;
    insuredAmount?: number | null;
    validityRule?: string | null;
  }>;
}

const QUOTE_AUDIT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    insurerName: { type: Type.STRING },
    contractorName: { type: Type.STRING, nullable: true },
    contractorNit: { type: Type.STRING, nullable: true },
    beneficiaryName: { type: Type.STRING, nullable: true },
    beneficiaryNit: { type: Type.STRING, nullable: true },
    contractNumber: { type: Type.STRING, nullable: true },
    objectDescription: { type: Type.STRING, nullable: true },
    contractValue: { type: Type.NUMBER, nullable: true },
    legalRegime: { type: Type.STRING, nullable: true },
    premiumAnnual: { type: Type.NUMBER, nullable: true },
    ratePercent: { type: Type.NUMBER, nullable: true },
    minimumPremiumApplied: { type: Type.BOOLEAN, nullable: true },
    paymentTerms: { type: Type.STRING, nullable: true },
    counterGuarantee: { type: Type.STRING, nullable: true },
    rceMaxDeductiblePercent: { type: Type.NUMBER, nullable: true },
    rceAmountCop: { type: Type.NUMBER, nullable: true },
    rceSubcoverages: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    coverages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          percentageOfContract: { type: Type.STRING, nullable: true },
          insuredAmount: { type: Type.NUMBER, nullable: true },
          validityRule: { type: Type.STRING, nullable: true },
        },
        required: ['name'],
      },
    },
  },
  required: ['insurerName', 'coverages'],
};

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeNit(nit?: string | null): string {
  return (nit || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
}

function extractPercent(raw?: string | null): number | null {
  if (!raw) return null;
  const match = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]!) : null;
}

function formatCop(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'No especificado';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Evaluates Ley 80 / Decreto 1082 de 2015 underwriting sufficiency rules for public contracts.
 */
export function evaluateDecreto1082Rules(
  prepolicy: CumplimientoPrepolicyData
): CumplimientoDecreto1082Alert[] {
  const alerts: CumplimientoDecreto1082Alert[] = [];
  if (prepolicy.legalRegime !== 'ESTATAL_LEY_80') {
    return alerts;
  }

  const coverages = prepolicy.requiredCoverages || [];
  const findCov = (keywords: string[]) =>
    coverages.find((c) => {
      const target = normalizeText(`${c.name} ${c.canonicalName || ''}`);
      return keywords.some((kw) => target.includes(kw));
    });

  if (prepolicy.caseType === 'LICITACION') {
    const seriedad = findCov(['seriedad']);
    if (!seriedad) {
      alerts.push({
        id: 'd1082-seriedad-missing',
        ruleCode: 'DEC_1082_SERIEDAD',
        severity: 'CRITICAL',
        coverageName: 'Seriedad de la Oferta',
        message: 'Licitación estatal sin amparo de Seriedad de la Oferta registrado.',
        recommendation: 'Exigir mínimo el 10% del presupuesto oficial o de la oferta.',
      });
    } else {
      const pct = seriedad.percentageNumeric ?? extractPercent(seriedad.percentageOfContract);
      if (
        pct !== null &&
        pct < 10 &&
        (!prepolicy.contractValue || prepolicy.contractValue < env.SMMLV_VALUE * 1_000_000)
      ) {
        alerts.push({
          id: 'd1082-seriedad-pct',
          ruleCode: 'DEC_1082_SERIEDAD_MIN',
          severity: 'WARNING',
          coverageName: seriedad.name,
          message: `Seriedad de la Oferta al ${pct}% es inferior al mínimo general del 10% (Decreto 1082).`,
          recommendation: 'Confirmar si aplica escala decreciente > 1M SMMLV o corregir al 10%.',
        });
      }
    }
  }

  const cumplimiento = findCov(['cumplimiento']);
  if (cumplimiento) {
    const pct = cumplimiento.percentageNumeric ?? extractPercent(cumplimiento.percentageOfContract);
    if (
      pct !== null &&
      pct < 10 &&
      (!prepolicy.contractValue || prepolicy.contractValue < env.SMMLV_VALUE * 1_000_000)
    ) {
      alerts.push({
        id: 'd1082-cumplimiento-pct',
        ruleCode: 'DEC_1082_CUMPLIMIENTO_MIN',
        severity: 'WARNING',
        coverageName: cumplimiento.name,
        message: `Amparo de Cumplimiento al ${pct}% está por debajo del 10% mínimo legal general.`,
        recommendation:
          'Verificar pliego/minuta; en Decreto 1082 el mínimo general es 10% + plazo de liquidación.',
      });
    }
    const val = normalizeText(
      `${cumplimiento.validityRule || ''} ${cumplimiento.additionalValidity || ''}`
    );
    if (val && !val.includes('liquid')) {
      alerts.push({
        id: 'd1082-cumplimiento-liq',
        ruleCode: 'DEC_1082_LIQUIDACION',
        severity: 'INFO',
        coverageName: cumplimiento.name,
        message: 'La vigencia de Cumplimiento no menciona explícitamente el plazo de liquidación.',
        recommendation:
          'Verificar si la entidad exige plazo de ejecución + 4 meses (o término de liquidación).',
      });
    }
  }

  if ((prepolicy.advancePaymentPercent ?? 0) > 0 || (prepolicy.advancePaymentAmount ?? 0) > 0) {
    const anticipo = findCov(['anticipo', 'pago anticipado']);
    if (!anticipo) {
      alerts.push({
        id: 'd1082-anticipo-missing',
        ruleCode: 'DEC_1082_ANTICIPO_100',
        severity: 'CRITICAL',
        coverageName: 'Buen Manejo y Correcta Inversión del Anticipo',
        message: 'El contrato contempla anticipo pero no figura el amparo de Anticipo en la tabla.',
        recommendation: 'Incluir amparo por el 100% del monto entregado como anticipo.',
      });
    } else {
      const pct = anticipo.percentageNumeric ?? extractPercent(anticipo.percentageOfContract);
      if (pct !== null && pct < 100) {
        alerts.push({
          id: 'd1082-anticipo-pct',
          ruleCode: 'DEC_1082_ANTICIPO_100',
          severity: 'CRITICAL',
          coverageName: anticipo.name,
          message: `El amparo de Anticipo aparece al ${pct}%; el Decreto 1082 exige el 100% del monto del anticipo.`,
          recommendation:
            'Ajustar al 100% del valor del anticipo hasta su amortización o liquidación.',
        });
      }
    }
  }

  const salarios = findCov(['salario', 'prestacion', 'laboral']);
  if (salarios) {
    const pct = salarios.percentageNumeric ?? extractPercent(salarios.percentageOfContract);
    if (pct !== null && pct < 5) {
      alerts.push({
        id: 'd1082-salarios-pct',
        ruleCode: 'DEC_1082_SALARIOS_5',
        severity: 'WARNING',
        coverageName: salarios.name,
        message: `Salarios y Prestaciones al ${pct}% es inferior al mínimo legal del 5%.`,
        recommendation: 'Ajustar al 5% del valor total del contrato.',
      });
    }
    const val = normalizeText(
      `${salarios.validityRule || ''} ${salarios.additionalValidity || ''}`
    );
    if (val && !val.includes('3') && !val.includes('tres')) {
      alerts.push({
        id: 'd1082-salarios-3y',
        ruleCode: 'DEC_1082_SALARIOS_3Y',
        severity: 'WARNING',
        coverageName: salarios.name,
        message: 'Salarios y Prestaciones debe cubrir el plazo del contrato y tres (3) años más.',
        recommendation: 'Confirmar vigencia: Plazo de ejecución + 3 años adicionales.',
      });
    }
  }

  if (prepolicy.contractType === 'OBRA') {
    const estabilidad = findCov(['estabilidad']);
    if (!estabilidad) {
      alerts.push({
        id: 'd1082-estabilidad-missing',
        ruleCode: 'DEC_1082_ESTABILIDAD_OBRA',
        severity: 'WARNING',
        coverageName: 'Estabilidad y Calidad de la Obra',
        message: 'Contrato de OBRA sin amparo de Estabilidad y Calidad de la Obra registrado.',
        recommendation:
          'Verificar si el pliego exige Estabilidad (regla general: 5 años desde acta de recibo final).',
      });
    }
    if (!prepolicy.rceRequirement?.required) {
      alerts.push({
        id: 'd1082-rce-obra',
        ruleCode: 'DEC_1082_RCE_OBRA',
        severity: 'WARNING',
        coverageName: 'RCE Derivada',
        message:
          'En contratos de OBRA pública suele ser obligatoria la póliza de RCE Derivada (Art. 2.2.1.2.3.1.17).',
        recommendation:
          'Verificar cuantía en SMMLV (mínimo 200 SMMLV hasta 1.500 SMMLV) y deducible máximo del 10%.',
      });
    }
  }

  if (
    prepolicy.contractor.personType === 'CONSORCIO' ||
    prepolicy.contractor.personType === 'UNION_TEMPORAL'
  ) {
    const members = prepolicy.contractor.consortiumMembers || [];
    if (members.length === 0) {
      alerts.push({
        id: 'd1082-consorcio-members',
        ruleCode: 'DEC_1082_CONSORCIO_UT',
        severity: 'WARNING',
        message: `Tomador es ${prepolicy.contractor.personType} pero aún no tiene integrantes y porcentajes de participación cargados.`,
        recommendation:
          'Registrar cada integrante con NIT y % de participación para el estudio de cupo y SARLAFT.',
      });
    }
  }

  return alerts;
}

/**
 * Builds the dynamic underwriting, SARLAFT, and credit-limit (cupo) checklist
 * aligned with proceso.docx and Colombian surety underwriting practice.
 */
export function buildDefaultComplianceChecklist(
  prepolicy: CumplimientoPrepolicyData,
  isNewClient: boolean
): CumplimientoChecklistItem[] {
  const items: CumplimientoChecklistItem[] = [
    {
      id: 'chk-doc-rector',
      code: 'DOC_RECTOR',
      category: 'BASE',
      label: 'Contrato, Pliego de Condiciones, Minuta u Orden de Compra/Servicio soporte',
      required: true,
      status: 'received',
    },
    {
      id: 'chk-rut',
      code: 'RUT',
      category: 'BASE',
      label: 'RUT actualizado del Tomador / Contratista',
      required: true,
      status: isNewClient ? 'pending' : 'verified',
    },
    {
      id: 'chk-listas',
      code: 'LISTAS_RESTRICTIVAS',
      category: 'SARLAFT',
      label:
        'Validación en listas restrictivas y vinculantes (OFAC, ONU, Contraloría, Procuraduría, Policía)',
      required: true,
      status: 'pending',
    },
    {
      id: 'chk-sarlaft',
      code: 'SARLAFT_FCC',
      category: 'SARLAFT',
      label: 'Formulario de Conocimiento del Cliente (SARLAFT) vigente y firmado',
      required: true,
      status: isNewClient ? 'pending' : 'received',
    },
    {
      id: 'chk-cupo',
      code: 'CUPO_ASEGURADORA',
      category: 'BASE',
      label: 'Verificación / aprobación de Cupo de Afianzamiento con la aseguradora',
      required: true,
      status: isNewClient ? 'pending' : 'received',
    },
  ];

  const personType = prepolicy.contractor.personType;
  if (personType === 'NATURAL') {
    items.push(
      {
        id: 'chk-cc-nat',
        code: 'CEDULA_NATURAL',
        category: 'NATURAL',
        label: 'Fotocopia del documento de identidad del contratista (Persona Natural)',
        required: true,
        status: isNewClient ? 'pending' : 'verified',
      },
      {
        id: 'chk-camara-nat',
        code: 'CAMARA_COMERCIO_NAT',
        category: 'NATURAL',
        label: 'Certificado de Matrícula Mercantil / Cámara de Comercio (≤ 30 días, si aplica)',
        required: false,
        status: 'pending',
        maxAgeDays: 30,
      },
      {
        id: 'chk-renta-nat',
        code: 'RENTA_EEFF_NAT',
        category: 'NATURAL',
        label: 'Declaración de Renta y/o Estados Financieros (según ingresos o cuantía)',
        required: true,
        status: isNewClient ? 'pending' : 'received',
      }
    );
  } else {
    items.push(
      {
        id: 'chk-cc-rl',
        code: 'CEDULA_RL',
        category: 'JURIDICA',
        label: 'Cédula de ciudadanía del Representante Legal',
        required: true,
        status: isNewClient ? 'pending' : 'verified',
      },
      {
        id: 'chk-camara-jur',
        code: 'CAMARA_COMERCIO_30D',
        category: 'JURIDICA',
        label: 'Certificado de Existencia y Representación Legal (Cámara de Comercio ≤ 30 días)',
        required: true,
        status: 'pending',
        maxAgeDays: 30,
      },
      {
        id: 'chk-eeff-jur',
        code: 'ESTADOS_FINANCIEROS',
        category: 'JURIDICA',
        label:
          'Estados Financieros comparativos último cierre (con notas y dictamen Revisor Fiscal si aplica)',
        required: true,
        status: isNewClient ? 'pending' : 'received',
      },
      {
        id: 'chk-renta-jur',
        code: 'DECLARACION_RENTA',
        category: 'JURIDICA',
        label: 'Declaración de Renta último periodo gravable',
        required: true,
        status: isNewClient ? 'pending' : 'received',
      },
      {
        id: 'chk-accionaria',
        code: 'COMPOSICION_ACCIONARIA',
        category: 'SARLAFT',
        label: 'Composición Accionaria / Beneficiarios Finales (≥ 5% / RUB)',
        required: true,
        status: isNewClient ? 'pending' : 'received',
      }
    );
  }

  if (personType === 'CONSORCIO' || personType === 'UNION_TEMPORAL') {
    items.push(
      {
        id: 'chk-acta-consorcio',
        code: 'ACTA_CONSORCIO_UT',
        category: 'CONSORCIO',
        label:
          'Documento de constitución del Consorcio / Unión Temporal (% de participación y representante)',
        required: true,
        status: 'pending',
      },
      {
        id: 'chk-rut-consorcio',
        code: 'RUT_CONSORCIO_UT',
        category: 'CONSORCIO',
        label:
          'RUT del Consorcio / UT y paquete documental (Cámara, RUT, EEFF, SARLAFT) de cada integrante',
        required: true,
        status: 'pending',
      }
    );
  }

  items.push({
    id: 'chk-rup-exp',
    code: 'EXPERIENCIA_RUP',
    category: 'BASE',
    label:
      prepolicy.legalRegime === 'ESTATAL_LEY_80'
        ? 'RUP vigente y soportes de experiencia contractual (Contratación Pública)'
        : 'Soportes de experiencia contractual / técnica (si lo exige la aseguradora)',
    required: prepolicy.legalRegime === 'ESTATAL_LEY_80',
    status: 'pending',
  });

  items.push({
    id: 'chk-pagare',
    code: 'PAGARE_CONTRAGARANTIA',
    category: 'POST_EMISION',
    label:
      'Pagaré y Carta de Instrucciones firmados (contragarantía — control de emisión/post-emisión)',
    required: true,
    status: 'pending',
  });

  return items;
}

/**
 * Extracts structured fields from a quote, draft policy, or endorsement PDF for Cumplimiento auditing.
 */
export async function extractQuoteSummaryForCumplimiento(file: {
  path: string;
  originalname: string;
}): Promise<CumplimientoExtractedQuote> {
  const extraction = await pdfExtractor.extractTextFromPdf(file.path);
  const cleanText = sanitizeForPostgres(extraction.text || '');

  if (env.GEMINI_API_KEY) {
    try {
      const genAI = getGenAI();
      const prompt = `Analiza esta cotización, borrador de póliza o anexo de Cumplimiento/Fianzas en Colombia y extrae exactamente los datos tal como aparecen escritos (no corrijas errores del documento):
- insurerName: nombre de la aseguradora
- contractorName, contractorNit: tomador/afianzado y su NIT/CC
- beneficiaryName, beneficiaryNit: asegurado/beneficiario/entidad contratante y su NIT
- contractNumber, objectDescription, contractValue, legalRegime
- premiumAnnual, ratePercent, minimumPremiumApplied, paymentTerms, counterGuarantee
- rceMaxDeductiblePercent, rceAmountCop, rceSubcoverages (si trae RCE derivada)
- coverages: cada amparo con name, percentageOfContract, insuredAmount, validityRule

TEXTO DEL DOCUMENTO (${file.originalname}):
${cleanText.slice(0, 45000)}`;

      const response = await genAI.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: QUOTE_AUDIT_SCHEMA,
          temperature: 0.05,
        },
      });
      const repairResult = parseJsonWithRepair(response.text || '{}');
      const parsed = (
        repairResult.success && repairResult.data && typeof repairResult.data === 'object'
          ? repairResult.data
          : {}
      ) as Partial<CumplimientoExtractedQuote>;
      return {
        fileName: file.originalname,
        insurerName: sanitizeForPostgres(
          parsed.insurerName || file.originalname.replace(/\.pdf$/i, '')
        ),
        contractorName: parsed.contractorName ? sanitizeForPostgres(parsed.contractorName) : null,
        contractorNit: parsed.contractorNit ? sanitizeForPostgres(parsed.contractorNit) : null,
        beneficiaryName: parsed.beneficiaryName
          ? sanitizeForPostgres(parsed.beneficiaryName)
          : null,
        beneficiaryNit: parsed.beneficiaryNit ? sanitizeForPostgres(parsed.beneficiaryNit) : null,
        contractNumber: parsed.contractNumber ? sanitizeForPostgres(parsed.contractNumber) : null,
        objectDescription: parsed.objectDescription
          ? sanitizeForPostgres(parsed.objectDescription)
          : null,
        contractValue: typeof parsed.contractValue === 'number' ? parsed.contractValue : null,
        legalRegime: parsed.legalRegime ? sanitizeForPostgres(parsed.legalRegime) : null,
        premiumAnnual: typeof parsed.premiumAnnual === 'number' ? parsed.premiumAnnual : null,
        ratePercent: typeof parsed.ratePercent === 'number' ? parsed.ratePercent : null,
        minimumPremiumApplied: parsed.minimumPremiumApplied ?? null,
        paymentTerms: parsed.paymentTerms ? sanitizeForPostgres(parsed.paymentTerms) : null,
        counterGuarantee: parsed.counterGuarantee
          ? sanitizeForPostgres(parsed.counterGuarantee)
          : null,
        rceMaxDeductiblePercent:
          typeof parsed.rceMaxDeductiblePercent === 'number'
            ? parsed.rceMaxDeductiblePercent
            : null,
        rceAmountCop: typeof parsed.rceAmountCop === 'number' ? parsed.rceAmountCop : null,
        rceSubcoverages: Array.isArray(parsed.rceSubcoverages)
          ? parsed.rceSubcoverages.map((s) => sanitizeForPostgres(s))
          : [],
        coverages: Array.isArray(parsed.coverages)
          ? parsed.coverages.map((c) => ({
              name: sanitizeForPostgres(c.name),
              percentageOfContract: c.percentageOfContract
                ? sanitizeForPostgres(c.percentageOfContract)
                : null,
              insuredAmount: typeof c.insuredAmount === 'number' ? c.insuredAmount : null,
              validityRule: c.validityRule ? sanitizeForPostgres(c.validityRule) : null,
            }))
          : [],
      };
    } catch (error) {
      console.warn('[CumplimientoAuditService] Gemini quote extraction fallback:', error);
    }
  }

  return {
    fileName: file.originalname,
    insurerName: file.originalname.replace(/\.pdf$/i, ''),
    coverages: [],
  };
}

/**
 * Performs deterministic field-by-field audit of one or more quotes/drafts against the saved Pre-policy.
 */
export function validateQuotesAgainstPrepolicy(
  prepolicy: CumplimientoPrepolicyData,
  quotes: CumplimientoExtractedQuote[],
  validationTarget: CumplimientoValidationTarget,
  clauseIdsUsed: string[] = []
): CumplimientoValidationRecord {
  const fieldChecks: CumplimientoFieldCheck[] = [];
  const economicComparison: CumplimientoQuoteEconomicRow[] = [];

  for (const quote of quotes) {
    let blocking = 0;
    let review = 0;

    const pushCheck = (check: CumplimientoFieldCheck) => {
      if (check.severity === 'BLOCKING') blocking++;
      if (check.status === 'REVIEW' || check.severity === 'WARNING') review++;
      fieldChecks.push(check);
    };

    // 1. Tomador (Nombre + NIT)
    if (!quote.contractorName) {
      pushCheck({
        fieldKey: 'contractor.name',
        fieldLabel: 'Tomador / Contratista (Razón Social)',
        block: 'PARTES',
        expectedValue: prepolicy.contractor.name || 'No definido',
        foundValue: 'No detectado en el documento',
        status: 'MISSING',
        severity: 'BLOCKING',
        insurerName: quote.insurerName,
      });
    } else {
      const match =
        normalizeText(quote.contractorName) === normalizeText(prepolicy.contractor.name) ||
        normalizeText(quote.contractorName).includes(normalizeText(prepolicy.contractor.name)) ||
        normalizeText(prepolicy.contractor.name).includes(normalizeText(quote.contractorName));
      pushCheck({
        fieldKey: 'contractor.name',
        fieldLabel: 'Tomador / Contratista (Razón Social)',
        block: 'PARTES',
        expectedValue: prepolicy.contractor.name,
        foundValue: quote.contractorName,
        status: match ? 'MATCH' : 'MISMATCH',
        severity: match ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
      });
    }

    if (prepolicy.contractor.nit) {
      const expectedNit = normalizeNit(prepolicy.contractor.nit);
      const foundNit = normalizeNit(quote.contractorNit);
      const status = !foundNit ? 'MISSING' : foundNit === expectedNit ? 'MATCH' : 'MISMATCH';
      pushCheck({
        fieldKey: 'contractor.nit',
        fieldLabel: 'Tomador (NIT / C.C.)',
        block: 'PARTES',
        expectedValue: prepolicy.contractor.nit,
        foundValue: quote.contractorNit || 'No detectado',
        status,
        severity: status === 'MATCH' ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
      });
    }

    // 2. Asegurado / Beneficiario (Nombre + NIT)
    if (prepolicy.beneficiary.name) {
      const found = normalizeText(quote.beneficiaryName);
      const expected = normalizeText(prepolicy.beneficiary.name);
      const status = !found
        ? 'MISSING'
        : found === expected || found.includes(expected) || expected.includes(found)
          ? 'MATCH'
          : 'MISMATCH';
      pushCheck({
        fieldKey: 'beneficiary.name',
        fieldLabel: 'Asegurado / Beneficiario (Entidad)',
        block: 'PARTES',
        expectedValue: prepolicy.beneficiary.name,
        foundValue: quote.beneficiaryName || 'No detectado',
        status,
        severity: status === 'MATCH' ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
      });
    }

    if (prepolicy.beneficiary.nit) {
      const expectedNit = normalizeNit(prepolicy.beneficiary.nit);
      const foundNit = normalizeNit(quote.beneficiaryNit);
      const status = !foundNit ? 'MISSING' : foundNit === expectedNit ? 'MATCH' : 'MISMATCH';
      pushCheck({
        fieldKey: 'beneficiary.nit',
        fieldLabel: 'Asegurado / Beneficiario (NIT)',
        block: 'PARTES',
        expectedValue: prepolicy.beneficiary.nit,
        foundValue: quote.beneficiaryNit || 'No detectado',
        status,
        severity: status === 'MATCH' ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
      });
    }

    // 3. Número de contrato y Valor del contrato
    if (prepolicy.contractNumber) {
      const expNum = normalizeText(prepolicy.contractNumber);
      const fndNum = normalizeText(quote.contractNumber);
      const status = !fndNum
        ? 'MISSING'
        : fndNum.includes(expNum) || expNum.includes(fndNum)
          ? 'MATCH'
          : 'MISMATCH';
      pushCheck({
        fieldKey: 'contractNumber',
        fieldLabel: 'Número de Contrato / Proceso',
        block: 'CONTRATO',
        expectedValue: prepolicy.contractNumber,
        foundValue: quote.contractNumber || 'No detectado',
        status,
        severity: status === 'MATCH' ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
      });
    }

    if (typeof prepolicy.contractValue === 'number' && prepolicy.contractValue > 0) {
      const diff =
        typeof quote.contractValue === 'number'
          ? Math.abs(quote.contractValue - prepolicy.contractValue) / prepolicy.contractValue
          : null;
      const status = diff === null ? 'REVIEW' : diff <= 0.01 ? 'MATCH' : 'MISMATCH';
      pushCheck({
        fieldKey: 'contractValue',
        fieldLabel: 'Valor del Contrato',
        block: 'CONTRATO',
        expectedValue: formatCop(prepolicy.contractValue),
        foundValue: quote.contractValue ? formatCop(quote.contractValue) : 'No detectado',
        status,
        severity: status === 'MATCH' ? 'INFO' : status === 'MISMATCH' ? 'BLOCKING' : 'WARNING',
        insurerName: quote.insurerName,
      });
    }

    // 4. Amparos exigidos (cobertura, %, monto, vigencia)
    for (const reqCov of prepolicy.requiredCoverages) {
      const reqTokens = normalizeText(reqCov.name)
        .split(' ')
        .filter((t) => t.length >= 4);
      const matched = quote.coverages.find((qc) => {
        const qNorm = normalizeText(qc.name);
        return qNorm === normalizeText(reqCov.name) || reqTokens.some((tok) => qNorm.includes(tok));
      });

      if (!matched) {
        pushCheck({
          fieldKey: `coverage.${reqCov.id}`,
          fieldLabel: `Amparo: ${reqCov.name}`,
          block: 'AMPAROS',
          expectedValue: `${reqCov.percentageOfContract || ''} · ${formatCop(reqCov.minimumAmount)} · ${reqCov.validityRule || 'Vigencia contractual'}`,
          foundValue: 'No encontrado en la cotización/borrador',
          status: 'MISSING',
          severity: reqCov.isMandatory ? 'BLOCKING' : 'WARNING',
          insurerName: quote.insurerName,
        });
        continue;
      }

      const expPct = reqCov.percentageNumeric ?? extractPercent(reqCov.percentageOfContract);
      const fndPct = extractPercent(matched.percentageOfContract);
      const pctMismatch = expPct !== null && fndPct !== null && fndPct + 0.01 < expPct;
      const amountMismatch =
        typeof reqCov.minimumAmount === 'number' &&
        typeof matched.insuredAmount === 'number' &&
        matched.insuredAmount + 1 < reqCov.minimumAmount;

      const status = pctMismatch || amountMismatch ? 'MISMATCH' : 'MATCH';
      pushCheck({
        fieldKey: `coverage.${reqCov.id}`,
        fieldLabel: `Amparo: ${reqCov.name}`,
        block: 'AMPAROS',
        expectedValue: `${reqCov.percentageOfContract || '-'} | ${formatCop(reqCov.minimumAmount)} | ${reqCov.validityRule || '-'}`,
        foundValue: `${matched.percentageOfContract || '-'} | ${formatCop(matched.insuredAmount)} | ${matched.validityRule || '-'}`,
        status,
        severity: status === 'MATCH' ? 'INFO' : 'BLOCKING',
        insurerName: quote.insurerName,
        detail: pctMismatch
          ? `Porcentaje inferior al exigido (${fndPct}% vs ${expPct}%)`
          : amountMismatch
            ? `Valor asegurado inferior al mínimo (${formatCop(matched.insuredAmount)} vs ${formatCop(reqCov.minimumAmount)})`
            : undefined,
      });
    }

    // 5. RCE Derivada (si aplica)
    if (prepolicy.rceRequirement?.required) {
      if (
        prepolicy.legalRegime === 'ESTATAL_LEY_80' &&
        typeof quote.rceMaxDeductiblePercent === 'number' &&
        quote.rceMaxDeductiblePercent > 10
      ) {
        pushCheck({
          fieldKey: 'rce.deductible',
          fieldLabel: 'Deducible RCE Derivada (Decreto 1082)',
          block: 'RCE',
          expectedValue: 'Máximo 10% de cada pérdida (sin franquicia)',
          foundValue: `${quote.rceMaxDeductiblePercent}%`,
          status: 'MISMATCH',
          severity: 'BLOCKING',
          insurerName: quote.insurerName,
        });
      }
    }

    const rowStatus: CumplimientoQuoteEconomicRow['overallStatus'] =
      blocking > 0 ? 'REJECTED_RISK' : review > 0 ? 'PARTIAL_GAP' : 'COMPLIANT';

    economicComparison.push({
      insurerName: quote.insurerName,
      fileName: quote.fileName,
      premiumAnnual: quote.premiumAnnual ?? null,
      ratePercent: quote.ratePercent ?? null,
      minimumPremiumApplied: quote.minimumPremiumApplied ?? null,
      paymentTerms: quote.paymentTerms ?? null,
      counterGuarantee: quote.counterGuarantee ?? null,
      blockingGapsCount: blocking,
      reviewCount: review,
      overallStatus: rowStatus,
    });
  }

  const totalBlocking = economicComparison.reduce((acc, r) => acc + r.blockingGapsCount, 0);
  const totalReview = economicComparison.reduce((acc, r) => acc + r.reviewCount, 0);
  const overallStatus: CumplimientoValidationRecord['overallStatus'] =
    totalBlocking > 0 ? 'REJECTED_RISK' : totalReview > 0 ? 'PARTIAL_GAP' : 'COMPLIANT';

  const blockingItems = fieldChecks.filter((c) => c.severity === 'BLOCKING');
  const correctionMessage =
    blockingItems.length === 0
      ? 'Sin observaciones bloqueantes: la cotización/borrador coincide con los requisitos de la Pre-póliza.'
      : [
          `Solicitud de ajuste (${validationTarget} — Contrato ${prepolicy.contractNumber || 'S/N'}):`,
          ...blockingItems.map(
            (b, i) =>
              `${i + 1}. [${b.insurerName || 'Aseguradora'}] ${b.fieldLabel}: figura "${b.foundValue}" y debe decir "${b.expectedValue}".`
          ),
        ].join('\n');

  return {
    id: crypto.randomUUID(),
    validatedAt: new Date().toISOString(),
    validationTarget,
    quoteFileNames: quotes.map((q) => q.fileName),
    clauseIdsUsed,
    overallStatus,
    summary:
      totalBlocking === 0
        ? `Validación aprobada (${quotes.length} documento(s) auditado(s), 0 discrepancias bloqueantes).`
        : `Se detectaron ${totalBlocking} discrepancia(s) bloqueante(s) con riesgo de rechazo por la entidad contratante.`,
    fieldChecks,
    economicComparison,
    correctionMessage,
  };
}
