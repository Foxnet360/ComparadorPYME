import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const COPROPIEDADES_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros para COPROPIEDADES (Póliza Multiriesgo de Propiedad Horizontal bajo Ley 675 de 2001 en Colombia).

Extrae la información de las cotizaciones de copropiedades con estas secciones:
1. DATOS DE LA PÓLIZA / COPROPIEDAD: aseguradora, nombre del producto, nombre de la copropiedad/edificio, dirección, ciudad, número de unidades/aptos (si visible).
2. PRIMA: netPremium, fees/gastos, taxes/IVA, otherCharges, totalPayable, currency, periodicity.
3. COBERTURAS PRINCIPALES:
   - Incendio y Terremoto sobre Bienes Comunes (Ley 675 - Cobertura Obligatoria) – límite/valor asegurado edificación.
   - Responsabilidad Civil Extracontractual Áreas Comunes (Ley 675 - Cobertura Obligatoria) – límite RCE.
   - RC Directores y Administradores (D&O Copropiedades) – límite.
   - Equipo Eléctrico y Maquinaria (Ascensores, Plantas, Subestaciones, Bombas) – límite.
   - Sustracción y Hurto de Bienes Comunes – límite.
   - Rotura de Vidrios, Fachadas y Domos – límite.
   - Todo Riesgo Daño Material Copropiedades – límite.
   - Asistencia y Mantenimiento de Áreas Comunes – condiciones.
   - Daños por Agua, Anegación e Inundación – límite.
   - Manejo e Infidelidad de Empleados – límite.
   - AMIT, Terrorismo y Actos Malintencionados – límite.
   - Granizo, Vientos Fuertes y Tempestades – límite.
   - Remoción de Escombros y Gastos de Preservación – límite.
   - Pérdida de Expensas y Cuotas de Administración – límite.
4. DEDUCIBLES: expresar cada deducible con su tipo (% del valor asegurado, % de la pérdida, SMMLV, valor fijo) y su monto. NO omitir deducibles de Terremoto ni de Maquinaria/Ascensores.
5. NOTAS: condiciones especiales, cumplimiento Ley 675, exclusiones.

REGLAS CRÍTICAS:
- NO inventes coberturas, valores ni deducibles.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Pon especial atención a los deducibles de Terremoto (ej. % sobre valor asegurado vs % de la pérdida con mínimo en SMMLV).`;

const COPROPIEDADES_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Póliza Copropiedades / Propiedad Horizontal",
  "building": {
    "name": "Edificio / Conjunto Residencial",
    "address": "Calle 100 # 15-20",
    "city": "Bogotá",
    "units": 48
  },
  "premium": {
    "netPremium": 15000000,
    "fees": 150000,
    "taxes": 2850000,
    "otherCharges": 0,
    "totalPayable": 18000000,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "ley675Compliance": {
    "incendioTerremotoIncluded": true,
    "rceAreasComunesIncluded": true,
    "notes": "Cumple coberturas obligatorias Ley 675"
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS OBLIGATORIAS LEY 675",
      "rawName": "Incendio y Terremoto sobre Bienes Comunes",
      "insuredAmount": 15000000000,
      "deductible": "2% valor asegurado",
      "premium": null,
      "notes": "",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "deducibles": [
    {
      "appliesTo": "Terremoto",
      "value": 2,
      "unit": "% valor asegurado",
      "minimum": "5 SMMLV",
      "notes": ""
    }
  ],
  "specialConditions": [],
  "exclusions": []
}`;

const COPROPIEDADES_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Copropiedades quote extraction schema under Ley 675',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    building: {
      type: 'object',
      additionalProperties: true,
      properties: {
        name: { type: 'string', nullable: true },
        address: { type: 'string', nullable: true },
        city: { type: 'string', nullable: true },
        units: { type: 'number', nullable: true },
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
    ley675Compliance: {
      type: 'object',
      additionalProperties: true,
      properties: {
        incendioTerremotoIncluded: { type: 'boolean', nullable: true },
        rceAreasComunesIncluded: { type: 'boolean', nullable: true },
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

function buildCopropiedadesPrompt(contextNote?: string): string {
  let prompt = `${COPROPIEDADES_BASE_PROMPT}\n\n${COPROPIEDADES_FORMAT_INSTRUCTIONS}`;

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
- Verify explicitly whether mandatory Ley 675 coverages (Incendio/Terremoto & RCE) are included.
- Premium totalPayable must match a visible total in the PDF.

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar valores.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const copropiedadesPromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildCopropiedadesPrompt(notes.length > 0 ? notes.join('\n') : undefined);
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
    return buildCopropiedadesPrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de COPROPIEDADES requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "building", "premium", "ley675Compliance"
- "rawCoverages" con rawName, insuredAmount, deductible, rawTextSnippet y pageNumber
- "deducibles" con appliesTo, value, unit, minimum y notes

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => COPROPIEDADES_RESPONSE_SCHEMA,
};
