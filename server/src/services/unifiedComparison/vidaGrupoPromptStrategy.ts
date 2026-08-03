import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const VIDA_GRUPO_BASE_PROMPT = `Eres un extractor experto de cotizaciones de seguros de VIDA GRUPO / VIDA COLECTIVO en Colombia bajo la regulación de la Superintendencia Financiera de Colombia (SFC) y el Código de Comercio.

Extrae la información de las cotizaciones de vida grupo considerando las siguientes secciones y marco normativo colombiano:
1. DATOS DE LA PÓLIZA / COLECTIVO: aseguradora, nombre del producto, empresa/tomador, número de asegurados, ciudad.
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (0% exento en seguro de vida según Estatuto Tributario Art. 427), totalPayable, currency ("COP"), periodicity ("MENSUAL_POR_PERSONA", "ANUAL_POR_PERSONA" o "TOTAL_COLECTIVO").
3. MARCO NORMATIVO Y COBERTURAS PRINCIPALES:
   - Amparo Básico por Muerte (Cualquier Causa - Art. 1151 C.Co.): capital asegurado por persona en COP.
   - Incapacidad Total y Permanente (ITP - Pérdida de capacidad laboral ≥ 50% según dictamen Junta de Calificación de Invalidez Ley 100/1993): capital o % de anticipo.
   - Incapacidad Parcial Permanente (IPP - Pérdida de capacidad laboral < 50%): porcentaje o tabla de pérdidas anatómicas.
   - Muerte Accidental y Desmembración (MAyD): capital adicional en COP.
   - Enfermedades Graves: anticipo o suma asegurada independiente (cáncer, infarto, ACV, insuficiencia renal, etc.).
   - Auxilio Funerario / Gastos de Sepelio: valor del auxilio en COP, SMMLV o UVT.
   - Renta Diaria por Hospitalización / Incapacidad: monto diario en COP y días máximo.
   - Exoneración de Pago de Primas por Incapacidad: amparo de no cobro de primas tras declaración de invalidez.
   - Cobertura de Suicidio (Art. 1158 Código de Comercio): amparo desde el día 1 de vigencia vs. periodo de carencia (1 año).
   - Auxilio Educativo para Hijos: suma asegurada o mensualidad escolar amparada.
   - Auxilio de Canasta / Mantenimiento Familiar: monto mensual en COP y número de meses.
   - Anticipo por Enfermedad Terminal: % de anticipo del amparo básico (ej. 50%).
   - Doble Indemnización por Accidente de Tránsito: capital adicional.
   - Auxilio por Hijos con Enfermedades Congénitas: valor del auxilio.
   - Renta por Desempleo Involuntario: mensualidad amparada por desvinculación laboral.
4. CONDICIONES ESPECIALES Y EDADES DE ASEGURABILIDAD:
   - Edad máxima de ingreso (ej. 60 o 65 años).
   - Edad límite de permanencia (ej. 70 o 75 años).
   - Periodos de carencia por amparo voluntario.
   - Exámenes médicos / declaración de asegurabilidad según valor asegurado acumulado.
5. NOTAS Y EXCLUSIONES: deportes de alto riesgo, actos de guerra, exclusiones legales.

REGLAS CRÍTICAS DE EXTRACCIÓN:
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
    "notes": "Cubierto desde el primer día de vigencia según Art. 1158 C.Co."
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Amparo Básico por Muerte",
      "insuredAmount": 50000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "Cubre fallecimiento por cualquier causa",
      "rawTextSnippet": "...",
      "pageNumber": 1
    },
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Incapacidad Total y Permanente (ITP)",
      "insuredAmount": 50000000,
      "deductible": "No aplica",
      "premium": null,
      "notes": "Pérdida de capacidad laboral mayor o igual al 50%",
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
  description: 'Vida Grupo quote extraction schema compliant with Colombian insurance laws',
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

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (netPremium, totalPayable, insuredAmount, auxilios fijos) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 50000000 para $50.000.000 COP).
   - Tener en cuenta que el seguro de vida está exento de IVA en Colombia (taxes = 0).

2. PORCENTAJES Y VALORES DE AUXILIOS:
   - En campos de notas o descripciones con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "50%", "100% de la suma asegurada").
   - Preservar las unidades colombianas de auxilios: COP, SMMLV (Salario Mínimo Mensual Legal Vigente), o UVT (Unidad de Valor Tributario).

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Amparo Básico por Muerte", "Incapacidad Total y Permanente", "Auxilio Funerario", "Cobertura de Suicidio", "Auxilio Educativo para Hijos").

4. MARCO NORMATIVO COLOMBIANO:
   - Registrar la base legal del seguro de vida en Colombia (Código de Comercio Arts. 1151-1162, Dictamen de Invalidez Ley 100/1993, Circular Externa 050/2013 SFC).

### GROUNDING RULES (REQUIRED)

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
