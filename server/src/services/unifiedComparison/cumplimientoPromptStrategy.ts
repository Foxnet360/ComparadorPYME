import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const CUMPLIMIENTO_BASE_PROMPT = `Eres un extractor experto de PÓLIZAS DE CUMPLIMIENTO, FIANZAS Y GARANTÍAS en Colombia.

Extrae la información de las pólizas de cumplimiento con estas secciones:
1. DATOS DE LA PÓLIZA: aseguradora, nombre del producto, tipo (cumplimiento / manejo / TRC), tomador/afianzado, beneficiario, contrato garantizado.
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA, totalPayable, currency, periodicity.
3. GARANTÍAS PRECONTRACTUALES:
   - Seriedad de Oferta — valor asegurado y porcentaje sobre el valor de la oferta.
4. GARANTÍAS DE EJECUCIÓN (amparos del contrato vigente):
   - Cumplimiento de Contrato — suma asegurada, % sobre valor del contrato.
   - Correcta Inversión del Anticipo — suma asegurada equivalente al anticipo.
   - Salarios, Prestaciones e Indemnizaciones Laborales — suma asegurada.
5. GARANTÍAS POST-CONTRACTUALES:
   - Estabilidad y Calidad de Obra — suma asegurada y plazo post-entrega.
   - Calidad del Bien o Servicio — suma asegurada.
6. GARANTÍAS DE RESPONSABILIDAD:
   - Pago de Daños a Terceros (RC Contractual) — suma asegurada.
   - Responsabilidad Civil Extracontractual (RCE) durante ejecución — suma asegurada.
7. GARANTÍAS DE MANEJO:
   - Buen Manejo y Correcta Inversión de Bienes — suma asegurada.
   - Manejo de Empleados (Fidelidad Colectiva) — suma asegurada, número de empleados amparados.
   - Manejo Individual (Fidelidad / Forgery) — nombre del cargo, suma asegurada.
8. COBERTURAS DE OBRA (si aplica TRC/TRM):
   - Todo Riesgo Construcción / Montaje — suma asegurada de la obra, equipos.
9. CONDICIONES GENERALES:
   - Vigencia, Plazo y Condiciones del Amparo — fechas inicio/fin, prórroga automática, condiciones de renovación.
10. CUMPLIMIENTO NORMATIVO ESTATAL (Ley 80/1993 · Decreto 1082/2015):
    - Garantía Única de Cumplimiento: ¿la póliza ampara contrato estatal bajo Ley 80? ¿está expedida a favor de entidad pública? ¿cumple los porcentajes mínimos exigidos por el Decreto 1082/2015?

REGLAS CRÍTICAS:
- NO inventes amparos, valores ni porcentajes de cobertura.
- Si un campo no aparece en la póliza, usa null o "NO ESPECIFICADO".
- Para cada amparo incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Registra el porcentaje sobre el valor del contrato cuando esté disponible (ej. "10% del valor del contrato").
- Para contratación estatal, registra explícitamente si cumple Ley 80/1993 y Decreto 1082/2015.`;

const CUMPLIMIENTO_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Póliza de Cumplimiento / Fianza de Fiel Cumplimiento",
  "policyType": "CUMPLIMIENTO | MANEJO | TRC | MIXTA",
  "contractDetails": {
    "afianzado": "Nombre del Contratista",
    "beneficiary": "Entidad Pública / Beneficiario",
    "contractValue": 500000000,
    "contractDescription": "Construcción vía rural municipio X"
  },
  "premium": {
    "netPremium": 5000000,
    "fees": 0,
    "taxes": 950000,
    "totalPayable": 5950000,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "estatutoryCompliance": {
    "ley80_1993": true,
    "decreto1082_2015": true,
    "isPublicEntityBeneficiary": true,
    "minimumPercentagesMet": true,
    "notes": "Póliza expedida a favor de entidad estatal bajo Ley 80/1993"
  },
  "rawCoverages": [
    {
      "section": "GARANTÍAS DE EJECUCIÓN",
      "rawName": "Cumplimiento de Contrato",
      "insuredAmount": 50000000,
      "percentageOfContract": "10%",
      "validityStart": "2024-01-01",
      "validityEnd": "2025-01-01",
      "notes": "",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "generalConditions": {
    "hasAutomaticRenewal": false,
    "renewalConditions": "",
    "cancellationNoticeDays": 30
  },
  "specialConditions": [],
  "exclusions": []
}`;

const CUMPLIMIENTO_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Cumplimiento / Fianzas quote extraction schema',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    policyType: { type: 'string', nullable: true },
    contractDetails: {
      type: 'object',
      additionalProperties: true,
      properties: {
        afianzado: { type: 'string', nullable: true },
        beneficiary: { type: 'string', nullable: true },
        contractValue: { type: 'number', nullable: true },
        contractDescription: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    premium: {
      type: 'object',
      additionalProperties: true,
      properties: {
        netPremium: { type: 'number', nullable: true },
        fees: { type: 'number', nullable: true },
        taxes: { type: 'number', nullable: true },
        totalPayable: { type: 'number', nullable: true },
        currency: { type: 'string', nullable: true },
        periodicity: { type: 'string', nullable: true },
      },
    },
    estatutoryCompliance: {
      type: 'object',
      additionalProperties: true,
      properties: {
        ley80_1993: { type: 'boolean', nullable: true },
        decreto1082_2015: { type: 'boolean', nullable: true },
        isPublicEntityBeneficiary: { type: 'boolean', nullable: true },
        minimumPercentagesMet: { type: 'boolean', nullable: true },
        notes: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    rawCoverages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          section: { type: 'string', nullable: true },
          rawName: { type: 'string' },
          insuredAmount: { type: 'number', nullable: true },
          percentageOfContract: { type: 'string', nullable: true },
          validityStart: { type: 'string', nullable: true },
          validityEnd: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          rawTextSnippet: { type: 'string', nullable: true },
          pageNumber: { type: 'number', nullable: true },
        },
      },
      nullable: true,
    },
    generalConditions: {
      type: 'object',
      additionalProperties: true,
      properties: {
        hasAutomaticRenewal: { type: 'boolean', nullable: true },
        renewalConditions: { type: 'string', nullable: true },
        cancellationNoticeDays: { type: 'number', nullable: true },
      },
      nullable: true,
    },
    specialConditions: { type: 'array', items: { type: 'string' }, nullable: true },
    exclusions: { type: 'array', items: { type: 'string' }, nullable: true },
  },
};

function buildCumplimientoPrompt(contextNote?: string): string {
  let prompt = `${CUMPLIMIENTO_BASE_PROMPT}\n\n${CUMPLIMIENTO_FORMAT_INSTRUCTIONS}`;

  if (contextNote) {
    prompt += `\n\nCONTEXTO ADICIONAL:\n${contextNote}`;
  }

  prompt += `\n\n### GROUNDING RULES (REQUIRED)

For every coverage row you emit:
1. rawTextSnippet MUST be a contiguous substring of 50-150 characters copied verbatim from the PDF.
2. pageNumber MUST be the 1-based page number where that substring appears.
3. If you cannot locate the coverage in the PDF, set the coverage value to "NO ESPECIFICADO" and still provide your best snippet + page.
4. Do NOT invent snippet text.

### ANTI-HALLUCINATION RULES

- If a field is not present in the document, use "NO ESPECIFICADO" (for text) or null/0 (for numbers).
- Premium totalPayable must match a visible total in the PDF.
- percentageOfContract must be explicitly stated; do NOT calculate or infer.
- estatutoryCompliance fields must be based on explicit document references to Ley 80 or Decreto 1082; do NOT assume compliance.

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar porcentajes, valores ni cumplimiento normativo no explícito.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const cumplimientoPromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildCumplimientoPrompt(notes.length > 0 ? notes.join('\n') : undefined);
  },

  buildTemplatePrompt: (
    templateId: string,
    template: TemplateRegistryEntry,
    tables: LayoutTable[]
  ): string => {
    const contextNote = [
      `Template matched: ${templateId}`,
      `Insurer: ${template.insurer}`,
      `Display name: ${template.displayName}`,
      `Reconstructed tables: ${tables.length}`,
    ].join('\n');
    return buildCumplimientoPrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de CUMPLIMIENTO / FIANZAS requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "policyType", "contractDetails", "premium"
- "estatutoryCompliance" con referencias a Ley 80/1993 y Decreto 1082/2015
- "rawCoverages" con rawName, insuredAmount, percentageOfContract, rawTextSnippet y pageNumber
- "generalConditions", "specialConditions" y "exclusions"

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => CUMPLIMIENTO_RESPONSE_SCHEMA,
};
