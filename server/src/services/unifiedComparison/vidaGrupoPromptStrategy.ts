import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const VIDA_GRUPO_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros de VIDA GRUPO / VIDA COLECTIVO en Colombia.

Extrae la información de las cotizaciones de vida grupo con estas secciones:
1. DATOS DE LA PÓLIZA / COLECTIVO: aseguradora, nombre del producto, empresa/tomador, número de asegurados (si visible), ciudad.
2. PRIMA: netPremium, fees/gastos, taxes/IVA, totalPayable, currency, periodicity (mensual o anual por persona / total colectivo).
3. COBERTURAS PRINCIPALES:
   - Amparo Básico por Muerte (Cualquier Causa) – capital asegurado por persona.
   - Incapacidad Total y Permanente (ITP) – capital y % de invalidez (50%+).
   - Muerte Accidental y Desmembración (MAyD) – capital adicional.
   - Enfermedades Graves – anticipo o suma asegurada.
   - Auxilio Funerario / Gastos de Sepelio – valor del auxilio.
   - Renta Diaria por Hospitalización / Incapacidad – monto diario y días máximo.
   - Exoneración de Pago de Primas por Incapacidad – condiciones.
   - Cobertura de Suicidio – amparo desde día 1 o meses de carencia.
   - Auxilio Educativo para Hijos – suma asegurada.
   - Auxilio de Canasta / Mantenimiento Familiar – monto mensual y meses.
   - Anticipo por Enfermedad Terminal – % de anticipo.
   - Doble Indemnización por Accidente de Tránsito – capital adicional.
   - Auxilio por Hijos con Enfermedades Congénitas – valor del auxilio.
4. CONDICIONES ESPECIALES Y EDADES: edad máxima de ingreso, edad límite de permanencia, carencias, exámenes médicos requeridos.
5. NOTAS: exclusiones, reglas de asegurabilidad.

REGLAS CRÍTICAS:
- NO inventes coberturas, valores ni edades de permanencia.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Pon especial atención a las edades límites (ej. ingreso hasta 65 años, permanencia hasta 75 años) y reglas de suicidio.`;

const VIDA_GRUPO_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Vida Colectivo / Vida Grupo",
  "groupDetails": {
    "insuredCount": 50,
    "entryAgeLimit": "65 años",
    "permanenceAgeLimit": "75 años"
  },
  "premium": {
    "netPremium": 450000,
    "fees": 0,
    "taxes": 0,
    "totalPayable": 450000,
    "currency": "COP",
    "periodicity": "MENSUAL_POR_PERSONA"
  },
  "suicideCoverage": {
    "hasWaitingPeriod": false,
    "notes": "Cubierto desde el primer día de vigencia"
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Amparo Básico por Muerte",
      "insuredAmount": 50000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "specialConditions": [
    "Edad máxima de ingreso: 65 años",
    "Edad de permanencia: 75 años"
  ],
  "exclusions": []
}`;

const VIDA_GRUPO_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Vida Grupo quote extraction schema',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    groupDetails: {
      type: 'object',
      additionalProperties: true,
      properties: {
        insuredCount: { type: 'number', nullable: true },
        entryAgeLimit: { type: 'string', nullable: true },
        permanenceAgeLimit: { type: 'string', nullable: true },
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
    suicideCoverage: {
      type: 'object',
      additionalProperties: true,
      properties: {
        hasWaitingPeriod: { type: 'boolean', nullable: true },
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
          premium: { type: 'number', nullable: true },
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

function buildVidaGrupoPrompt(contextNote?: string): string {
  let prompt = `${VIDA_GRUPO_BASE_PROMPT}\n\n${VIDA_GRUPO_FORMAT_INSTRUCTIONS}`;

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

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar valores.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const vidaGrupoPromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildVidaGrupoPrompt(notes.length > 0 ? notes.join('\n') : undefined);
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
    return buildVidaGrupoPrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de VIDA GRUPO requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "groupDetails", "premium", "suicideCoverage"
- "rawCoverages" con rawName, insuredAmount, deductible, rawTextSnippet y pageNumber
- "specialConditions" y "exclusions"

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => VIDA_GRUPO_RESPONSE_SCHEMA,
};
