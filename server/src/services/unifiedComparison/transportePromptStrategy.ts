import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const TRANSPORTE_BASE_PROMPT = `Eres un extractor experto de SEGUROS DE TRANSPORTE DE MERCANCÍAS Y FLETES en Colombia.

Extrae la información de las pólizas/cotizaciones de transporte con estas secciones:
1. DATOS DE LA PÓLIZA: aseguradora, nombre del producto, tipo de póliza (flotante / por viaje / abierta), tomador, ruta (origen–destino), modo de transporte (terrestre/aéreo/marítimo/multimodal).
2. PRIMA: netPremium, fees/gastos, taxes/IVA, totalPayable, currency, periodicity, tasaPorMil (tasa aplicada por mil sobre el valor asegurado si aparece).
3. COBERTURAS PRINCIPALES:
   - Daño Material a la Carga (Todo Riesgo o Named Perils): alcance, mercancías cubiertas.
   - Pérdida Total (hurto, extravío, siniestro total): condiciones.
   - Robo y Hurto (con y sin violencia): suma asegurada, condiciones de seguridad exigidas.
   - Responsabilidad Civil del Transportador: suma asegurada, base legal (Código de Comercio / Decreto 1079/2015).
4. COBERTURAS MARÍTIMAS (si aplica):
   - Avería Particular y Avería Gruesa: términos cubiertos, cláusulas ICC (A/B/C).
5. COBERTURAS ESPECIALES:
   - Refrigeración y Carga Perecedera: temperatura controlada, falla de cadena de frío.
   - Carga a Granel o Peligrosa: clase ADR/IMDG/IATA, restricciones.
6. COBERTURAS COMPLEMENTARIAS:
   - Daño o Pérdida del Contenedor / Embalaje: suma asegurada.
   - Demora en la Entrega y Lucro Cesante: límite y condiciones.
7. VALOR ASEGURADO E INCOTERM:
   - Cobertura de Fletes e Impuestos según Incoterm (CIF / FOB / DAP / DDP): valor asegurado declarado, porcentaje de sobre-valor (ej. 110% del valor CIF).
8. CONDICIONES DE LA COBERTURA:
   - Deducibles y Franquicias: valor o porcentaje por tipo de siniestro.
   - Vigencia y Tipo de Póliza: fechas, modalidad (por viaje, flotante, abierta), declaraciones de embarque.
9. CUMPLIMIENTO NORMATIVO:
   - Marco Normativo (Decreto 1079/2015 · Código de Comercio · Incoterms 2020): ¿la póliza hace referencia explícita a normas colombianas o cláusulas ICC?

REGLAS CRÍTICAS:
- NO inventes coberturas, rutas, tasas ni valores asegurados.
- Si un campo no aparece en la póliza, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Registra la tasa (tasaPorMil) si aparece explícitamente; no la calcules.
- Para multimodal, registra todos los modos de transporte cubiertos.
- Las cláusulas ICC (A, B o C) son críticas en transporte marítimo; extráelas si están presentes.`;

const TRANSPORTE_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Seguro de Transporte de Mercancías",
  "policyType": "FLOTANTE | POR_VIAJE | ABIERTA",
  "transportDetails": {
    "mode": ["TERRESTRE", "MARITIMO", "AEREO"],
    "origin": "Bogotá",
    "destination": "Miami",
    "cargo": "Textiles — Cajas de cartón",
    "incoterm": "CIF",
    "insuredValue": 150000000,
    "insuredValuePercentage": "110%"
  },
  "premium": {
    "netPremium": 1500000,
    "fees": 0,
    "taxes": 285000,
    "totalPayable": 1785000,
    "currency": "COP",
    "periodicity": "POR_VIAJE",
    "tasaPorMil": 10.0
  },
  "iccClauses": {
    "clause": "A | B | C | NO_APLICA",
    "notes": "Cláusula A — Todo Riesgo"
  },
  "regulatoryCompliance": {
    "decreto1079_2015": true,
    "codigoDeComercio": true,
    "incoterms2020": true,
    "notes": ""
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Daño Material a la Carga — Todo Riesgo",
      "insuredAmount": 150000000,
      "deductible": "1% del valor asegurado, mínimo 1 SMMLV",
      "conditions": "",
      "notes": "",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "specialConditions": [],
  "exclusions": []
}`;

const TRANSPORTE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Transporte de Mercancías quote extraction schema',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    policyType: { type: 'string', nullable: true },
    transportDetails: {
      type: 'object',
      additionalProperties: true,
      properties: {
        mode: { type: 'array', items: { type: 'string' }, nullable: true },
        origin: { type: 'string', nullable: true },
        destination: { type: 'string', nullable: true },
        cargo: { type: 'string', nullable: true },
        incoterm: { type: 'string', nullable: true },
        insuredValue: { type: 'number', nullable: true },
        insuredValuePercentage: { type: 'string', nullable: true },
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
        tasaPorMil: { type: 'number', nullable: true },
      },
    },
    iccClauses: {
      type: 'object',
      additionalProperties: true,
      properties: {
        clause: { type: 'string', nullable: true },
        notes: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    regulatoryCompliance: {
      type: 'object',
      additionalProperties: true,
      properties: {
        decreto1079_2015: { type: 'boolean', nullable: true },
        codigoDeComercio: { type: 'boolean', nullable: true },
        incoterms2020: { type: 'boolean', nullable: true },
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
          deductible: { type: 'string', nullable: true },
          conditions: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          rawTextSnippet: { type: 'string', nullable: true },
          pageNumber: { type: 'number', nullable: true },
        },
      },
      nullable: true,
    },
    specialConditions: { type: 'array', items: { type: 'string' }, nullable: true },
    exclusions: { type: 'array', items: { type: 'string' }, nullable: true },
  },
};

function buildTransportePrompt(contextNote?: string): string {
  let prompt = `${TRANSPORTE_BASE_PROMPT}\n\n${TRANSPORTE_FORMAT_INSTRUCTIONS}`;

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
- tasaPorMil must be explicitly stated; do NOT calculate from premium and insured value.
- iccClauses.clause must be explicitly referenced in the document (A, B, or C); do NOT assume.
- regulatoryCompliance fields must be based on explicit document references; do NOT assume compliance.

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar tasas, incoterms, rutas ni cláusulas ICC no explícitas.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const transportePromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildTransportePrompt(notes.length > 0 ? notes.join('\n') : undefined);
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
    return buildTransportePrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de TRANSPORTE DE MERCANCÍAS requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "policyType", "transportDetails", "premium"
- "iccClauses" con cláusula ICC (A/B/C) si aplica transporte marítimo
- "regulatoryCompliance" con referencias a Decreto 1079/2015, Código de Comercio e Incoterms 2020
- "rawCoverages" con rawName, insuredAmount, deductible, rawTextSnippet y pageNumber
- "specialConditions" y "exclusions"

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => TRANSPORTE_RESPONSE_SCHEMA,
};
