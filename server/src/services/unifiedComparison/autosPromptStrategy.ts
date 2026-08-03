import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const AUTOS_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros de AUTOS colombianos bajo regulación de la Superintendencia Financiera de Colombia (SFC) y FASECOLDA.

Extrae la información de las cotizaciones de vehículos considerando las siguientes secciones y marco normativo colombiano:
1. DATOS DE LA PÓLIZA / VEHÍCULO: aseguradora, nombre del producto, placa (si es visible), modelo/año, uso del vehículo (particular, público, comercial), ciudad de circulación.
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (19%), otherCharges, totalPayable, currency ("COP"), periodicity ("ANUAL" o "MENSUAL").
3. MARCO NORMATIVO Y COBERTURAS PRINCIPALES:
   - SOAT (Seguro Obligatorio de Accidentes de Tránsito - Decreto 780/2016, Ley 2161/2021): vigencia y estado.
   - Responsabilidad Civil Extracontractual Vehicular (RCE - Código de Comercio Art. 1127): límite en COP (Daños a Bienes de Terceros, Muerte/Lesiones a 1 Persona, Muerte/Lesiones a 2 o más Personas).
   - Pérdida Total por Daños o Hurto (PTD / FNAC): condición de constitución de pérdida total (75% u 80% del valor comercial en lista FASECOLDA).
   - Pérdida Parcial por Daños o Hurto (PP): límite, repuestos y taller concesionario.
   - Carro Taller / Vehículo de Reemplazo: días de cobertura (ej: 10, 15, 30 días) y tipo de vehículo.
   - Asistencia en Viaje / Carretera: 24/7, servicio de grúa, auxilio mecánico, cerrajería, conductor elegido.
   - Gastos de Transporte / Peajes / Grúa: límites de reembolso.
   - Hurto de Partes y Accesorios: límite de accesorios, lujos o blindaje.
   - Eventos de la Naturaleza: granizo, terremoto, inundación, vendaval.
   - Conductor Adicional / Menores de 25 Años: recargos, deducibles agravados o condiciones de cobertura.
4. DEDUCIBLES: expresar cada deducible con su unidad original colombiana (% del siniestro, SMMLV - Salario Mínimo Mensual Legal Vigente, días de inmovilización, o valor fijo en COP). NO omitir deducibles.
5. NOTAS Y CONDICIONES: cláusulas de inspección, accesorios asegurados, exclusiones.

REGLAS CRÍTICAS DE EXTRACCIÓN:
- NO inventes coberturas, valores ni deducibles.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Los deducibles de autos pueden ser: porcentaje (%), SMMLV, días de inmovilización o valor fijo en COP; conserva la unidad original.
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
    "perdidaTotal": "80% del valor comercial FASECOLDA",
    "perdidaParcial": "Valor comercial del vehículo"
  },
  "carroTaller": "20 días / vehículo de reemplazo",
  "asistenciaViaje": "24/7, grúa, auxilio mecánico, conductor elegido",
  "rawCoverages": [
    {
      "section": "COBERTURAS",
      "rawName": "Responsabilidad Civil Extracontractual Vehicular",
      "insuredAmount": 1200000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "Amparo de daños a terceros y lesiones corporales",
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
      "notes": "10% del valor del siniestro, mínimo 2 SMMLV"
    },
    {
      "appliesTo": "Carro Taller",
      "value": 5,
      "unit": "días",
      "notes": "Deducible de 5 días de inmovilización"
    }
  ],
  "specialConditions": [],
  "exclusions": []
}`;

const AUTOS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Autos quote extraction schema compliant with Colombian insurance standards',
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

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (netPremium, fees, taxes, totalPayable, rceLimit, insuredAmount) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 3025000 para $3.025.000 COP).

2. PORCENTAJES Y DEDUCIBLES:
   - En campos de deducibles o notas con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "10%", "10% del siniestro").
   - Preservar las unidades colombianas de deducibles: SMMLV (Salario Mínimo Mensual Legal Vigente), % del siniestro, días de inmovilización, o valor fijo en COP.

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Responsabilidad Civil Extracontractual Vehicular", "Pérdida Total", "Pérdida Parcial", "Vehículo de Reemplazo", "Asistencia en Viaje").

4. MARCO NORMATIVO COLOMBIANO:
   - Registrar la base normativa de seguros de autos en Colombia cuando aparezca en el documento (SOAT Decreto 780/2016, Código de Comercio Art. 1127, Circular Externa 050/2013 SFC, condicionado FASECOLDA).

### GROUNDING RULES (REQUIRED)

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
