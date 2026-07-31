import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const AUTOS_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros de AUTOS colombianos.

Extrae la información de las cotizaciones de vehículos con estas secciones:
1. DATOS DE LA PÓLIZA / VEHÍCULO: aseguradora, nombre del producto, placa (si visible), modelo, uso del vehículo, ciudad de circulación.
2. PRIMA: netPremium, fees/gastos, taxes/IVA, otherCharges, totalPayable, currency, periodicity.
3. COBERTURAS PRINCIPALES:
   - Responsabilidad Civil Extracontractual Vehicular (RCE) – límite en COP.
   - Pérdida Total (hurto, daños, PT) – límite y condiciones.
   - Pérdida Parcial (colisión, PP) – límite y condiciones.
   - Carro Taller / Vehículo de Reemplazo – días / condiciones.
   - Asistencia en Viaje / Carretera – 24/7, servicios incluidos.
   - Gastos de Transporte / Peajes / Grúa – límites.
   - Hurto de Partes y Accesorios – límites.
   - Eventos de la Naturaleza (granizo, inundación) – condiciones.
   - Conductor Adicional / Menores de 25 Años – condiciones.
4. DEDUCIBLES: expresar cada deducible con su tipo (% del siniestro, SMMLV, días de inmovilización, valor fijo) y su monto. NO omitir deducibles.
5. NOTAS: condiciones especiales, exclusiones, cláusulas adicionales.

REGLAS CRÍTICAS:
- NO inventes coberturas, valores ni deducibles.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Los deducibles de autos pueden ser: porcentaje (%), SMMLV, días de inmovilización o valor fijo; conserva la unidad original.
- No uses los nombres canónicos de PYME (Incendio, Terremoto, etc.).`;

const AUTOS_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Producto Autos",
  "vehicle": {
    "plate": "ABC123",
    "model": "2024",
    "usage": "Particular",
    "city": "Bogotá"
  },
  "premium": {
    "netPremium": 2500000,
    "fees": 50000,
    "taxes": 475000,
    "otherCharges": 0,
    "totalPayable": 3025000,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rceLimit": 1200000000,
  "ptPpDetails": {
    "perdidaTotal": "Valor asegurado del vehículo",
    "perdidaParcial": "Valor asegurado del vehículo"
  },
  "carroTaller": "20 días / vehículo de reemplazo",
  "asistenciaViaje": "24/7, grúa, auxilio mecánico",
  "rawCoverages": [
    {
      "section": "COBERTURAS",
      "rawName": "Responsabilidad Civil Extracontractual",
      "insuredAmount": 1200000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "deducibles": [
    {
      "appliesTo": "Pérdida Parcial",
      "value": 10,
      "unit": "%",
      "minimum": "2 SMMLV",
      "notes": ""
    },
    {
      "appliesTo": "Carro Taller",
      "value": 5,
      "unit": "días",
      "notes": ""
    }
  ],
  "specialConditions": [],
  "exclusions": []
}`;

const AUTOS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Autos quote extraction schema (looser than PYME)',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    vehicle: {
      type: 'object',
      additionalProperties: true,
      properties: {
        plate: { type: 'string', nullable: true },
        model: { type: 'string', nullable: true },
        usage: { type: 'string', nullable: true },
        city: { type: 'string', nullable: true },
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
        otherCharges: { type: 'number', nullable: true },
        totalPayable: { type: 'number', nullable: true },
        currency: { type: 'string', nullable: true },
        periodicity: { type: 'string', nullable: true },
      },
    },
    rceLimit: { type: 'number', nullable: true },
    ptPpDetails: { type: 'object', additionalProperties: true, nullable: true },
    carroTaller: { type: 'string', nullable: true },
    asistenciaViaje: { type: 'string', nullable: true },
    rawCoverages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          section: { type: 'string', nullable: true },
          rawName: { type: 'string' },
          insuredAmount: { type: 'number', nullable: true },
          deductible: { type: 'string', nullable: true },
          premium: { type: 'number', nullable: true },
          notes: { type: 'string', nullable: true },
          rawTextSnippet: { type: 'string', nullable: true },
          pageNumber: { type: 'number', nullable: true },
        },
      },
      nullable: true,
    },
    deducibles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          appliesTo: { type: 'string', nullable: true },
          value: { type: 'number', nullable: true },
          unit: { type: 'string', nullable: true },
          minimum: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
        },
      },
      nullable: true,
    },
    specialConditions: { type: 'array', items: { type: 'string' }, nullable: true },
    exclusions: { type: 'array', items: { type: 'string' }, nullable: true },
  },
};

function buildAutosPrompt(contextNote?: string): string {
  let prompt = `${AUTOS_BASE_PROMPT}\n\n${AUTOS_FORMAT_INSTRUCTIONS}`;

  if (contextNote) {
    prompt += `\n\nCONTEXTO ADICIONAL:\n${contextNote}`;
  }

  prompt += `\n\n### GROUNDING RULES (REQUIRED)

For every coverage row you emit:
1. rawTextSnippet MUST be a contiguous substring of 50-150 characters copied verbatim from the PDF.
2. pageNumber MUST be the 1-based page number where that substring appears.
3. If you cannot locate the coverage in the PDF, set the coverage value to "NO ESPECIFICADO" and still provide your best snippet + page.
4. Do NOT invent snippet text. If the exact wording is unclear, copy the nearest relevant clause text.

### ANTI-HALLUCINATION RULES

- If a field is not present in the document, use "NO ESPECIFICADO" (for text) or null/0 (for numbers).
- Do NOT list coverages you believe "should" be in an autos policy unless they appear in the document.
- Premium totalPayable must match a visible total in the PDF.

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar valores.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const autosPromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildAutosPrompt(notes.length > 0 ? notes.join('\n') : undefined);
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
    return buildAutosPrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de AUTOS requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "vehicle", "premium"
- "rceLimit", "ptPpDetails", "carroTaller", "asistenciaViaje"
- "rawCoverages" con rawName, insuredAmount, deductible, rawTextSnippet y pageNumber
- "deducibles" con appliesTo, value, unit (% / SMMLV / días / fijo), minimum y notes

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => AUTOS_RESPONSE_SCHEMA,
};
