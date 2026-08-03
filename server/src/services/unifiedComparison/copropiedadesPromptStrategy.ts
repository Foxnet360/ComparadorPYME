import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const COPROPIEDADES_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros para COPROPIEDADES (Póliza Multiriesgo de Propiedad Horizontal bajo Ley 675 de 2001 y norma sismo resistente NSR-10 en Colombia).

Extrae la información de las cotizaciones de copropiedades considerando las siguientes secciones y marco normativo colombiano:
1. DATOS DE LA PÓLIZA / COPROPIEDAD: aseguradora, nombre del producto, nombre de la copropiedad/edificio, dirección, ciudad, número de unidades/aptos (si es visible).
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (19%), otherCharges, totalPayable, currency ("COP"), periodicity ("ANUAL").
3. MARCO NORMATIVO Y COBERTURAS PRINCIPALES:
   - Incendio, Rayo y Explosión sobre Bienes Comunes (Ley 675 de 2001 - Cobertura Obligatoria por Valor de Reposición) – límite/valor asegurado edificación.
   - Terremoto, Temblor y Erupción Volcánica sobre Bienes Comunes (Ley 675 y NSR-10 - Cobertura Obligatoria) – límite y deducible especial de sismo.
   - Responsabilidad Civil Extracontractual Áreas Comunes (Ley 675 de 2001 - Cobertura Obligatoria) – límite RCE.
   - RC Directores y Administradores (D&O Copropiedades) – límite de responsabilidad para el Consejo de Administración y Administrador.
   - Responsabilidad Civil Patronal – amparo para empleados directos o contratistas de áreas comunes (portería, aseo, mantenimiento).
   - Equipo Eléctrico y Maquinaria de Zonas Comunes (Ascensores, Plantas Eléctricas, Subestaciones, Bombas de Agua, Equipos HVAC) – límite y deducible.
   - Sustracción y Hurto de Bienes Comunes – límite de hurto calificado y simple.
   - Rotura de Vidrios, Fachadas y Domos – límite de cristales.
   - Todo Riesgo Daño Material Copropiedades – límite amparo básico.
   - Asistencia y Mantenimiento de Áreas Comunes – servicios 24/7 y plomería/cerrajería urgente.
   - Daños por Agua, Anegación e Inundación – límite y deducible.
   - Manejo e Infidelidad de Empleados – límite por actos deshonestos del administrador o tesorero.
   - AMIT, Terrorismo y Actos Malintencionados – límite amparo especial.
   - Granizo, Vientos Fuertes y Tempestades – límite por eventos naturales.
   - Remoción de Escombros y Gastos de Preservación – límite complementario.
   - Pérdida de Expensas y Cuotas de Administración – límite por interrupción de ingresos de la copropiedad.
4. DEDUCIBLES: expresar cada deducible con su unidad original colombiana (% del valor asegurado, % de la pérdida, SMMLV - Salario Mínimo Mensual Legal Vigente, o valor fijo en COP). NO omitir deducibles de Terremoto ni de Ascensores/Maquinaria.
5. CUMPLIMIENTO LEY 675: verificar y registrar explícitamente si el plan ampara las coberturas obligatorias exigidas por la Ley 675 de 2001.

REGLAS CRÍTICAS DE EXTRACCIÓN:
- NO inventes coberturas, valores ni deducibles.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Pon especial atención a los deducibles de Terremoto (ej. 2% sobre valor asegurado con mínimo en SMMLV).`;

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
    "notes": "Cumple coberturas obligatorias Ley 675 de 2001"
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS OBLIGATORIAS LEY 675",
      "rawName": "Incendio, Rayo y Explosión sobre Bienes Comunes",
      "insuredAmount": 15000000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "Valor de reposición a nuevo según Ley 675",
      "rawTextSnippet": "...",
      "pageNumber": 1
    },
    {
      "section": "COBERTURAS OBLIGATORIAS LEY 675",
      "rawName": "Terremoto, Temblor y Erupción Volcánica sobre Bienes Comunes",
      "insuredAmount": 15000000000,
      "deductible": "2% valor asegurado, mínimo 5 SMMLV",
      "premium": null,
      "notes": "Cumple norma sismo resistente NSR-10",
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
      "notes": "2% del valor asegurado de la edificación"
    }
  ],
  "specialConditions": [],
  "exclusions": []
}`;

const COPROPIEDADES_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Copropiedades quote extraction schema under Ley 675 and NSR-10',
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

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (netPremium, fees, taxes, totalPayable, insuredAmount) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 18000000 para $18.000.000 COP).

2. PORCENTAJES Y DEDUCIBLES:
   - En campos de deducibles o notas con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "2%", "2% valor asegurado").
   - Preservar las unidades colombianas de deducibles: SMMLV (Salario Mínimo Mensual Legal Vigente), % del valor asegurado, % de la pérdida, o valor fijo en COP.

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Incendio, Rayo y Explosión sobre Bienes Comunes", "Terremoto, Temblor y Erupción Volcánica sobre Bienes Comunes", "Responsabilidad Civil Extracontractual Áreas Comunes", "RC Directores y Administradores", "Equipo Eléctrico y Maquinaria").

4. MARCO NORMATIVO COLOMBIANO:
   - Registrar la base normativa de propiedad horizontal en Colombia (Ley 675 de 2001, Reglamento NSR-10, Circular Externa 050/2013 SFC).

### GROUNDING RULES (REQUIRED)

For every coverage row you emit:
1. rawTextSnippet MUST be a contiguous substring of 50-150 characters copied verbatim from the PDF.
2. pageNumber MUST be the 1-based page number where that substring appears.
3. If you cannot locate the coverage in the PDF, set the coverage value to "NO ESPECIFICADO" and still provide your best snippet + page.
4. Do NOT invent snippet text. If the exact wording is unclear, copy the nearest relevant clause text.

### ANTI-HALLUCINATION RULES

- If a field is not present in the document, use "NO ESPECIFICADO" (for text) or null/0 (for numbers).
- Verify explicitly whether mandatory Ley 675 coverages (Incendio, Terremoto & RCE) are included.
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
