import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const SALUD_BASE_PROMPT = `Eres un extractor experto de cotizaciones de PLANES VOLUNTARIOS DE SALUD (PVS) y MEDICINA PREPAGADA en Colombia bajo regulación del Ministerio de Salud (Res. 244/2019) y la Superintendencia Financiera de Colombia (SFC).

Extrae la información de las cotizaciones de salud considerando las siguientes secciones y marco normativo colombiano:
1. DATOS DEL PLAN: aseguradora, nombre del producto, tipo de plan ("COMPLEMENTARIO" al PBS/POS de la EPS u "SUSTITUTIVO"), ciudad de cobertura.
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (19%), totalPayable, currency ("COP"), periodicity ("MENSUAL", "TRIMESTRAL", "ANUAL"), periodicityPerPerson (si varía por edad o rango de edad).
3. ESTRUCTURA Y COMPLEMENTARIEDAD DEL PLAN:
   - Plan de Beneficios Base: especificar si es un complemento al PBS (Plan de Beneficios en Salud obligatorio) de la EPS o sustituto.
4. COBERTURAS HOSPITALARIAS:
   - Hospitalización y Cirugía: límites de días, habitación privada individual, Unidad de Cuidados Intensivos (UCI), procedimientos quirúrgicos.
   - Hospitalización Domiciliaria y Atención en Casa (Home Care): servicios de enfermería domiciliaria y equipos médicos en casa.
5. COBERTURAS AMBULATORIAS:
   - Consulta Médica Especialista y Telemedicina: acceso directo a especialistas sin remisión, valor del copago, telemedicina disponible.
   - Medicamentos: amparo de medicamentos ambulatorios y hospitalarios fuera de listado POS, límites anuales.
6. COBERTURAS DE URGENCIAS:
   - Urgencias Nacionales: cobertura en red de clínicas IPS.
   - Urgencias Internacionales: suma asegurada en USD o EUR y límites geográficos.
7. ENFERMEDADES DE ALTO COSTO:
   - Oncología: tratamientos de alto costo (quimioterapia, radioterapia, inmunoterapia), sumas aseguradas o sin límite.
8. COBERTURAS ESPECIALES:
   - Maternidad y Neonatología: semanas o meses de carencia exigidos, cobertura de parto normal o cesárea, recién nacido patológico.
   - Salud Mental y Psiquiatría: número de sesiones anuales de psicología/psiquiatría, internación psiquiátrica.
9. COBERTURAS PREVENTIVAS Y COMPLEMENTARIAS:
   - Medicina Preventiva, Vacunación y Programas de Bienestar: chequeos ejecutivos, exámenes de prevención, esquema de vacunación.
   - Odontología: preventiva, restaurativa, ortodoncia, prótesis, límite anual en COP.
   - Optometría y Oftalmología: examen visual, monturas/lentes, cirugía refractiva.
   - Cobertura Internacional y Repatriación: suma asegurada y repatriación sanitaria.
10. CONDICIONES DE ASEGURABILIDAD:
    - Preexistencias: cómo se manejan ("EXCLUSION", "ACEPTACION_CON_CARENCIA", "DECLARACION_JURADA").
    - Red de Prestadores (IPS/Clínicas): clínicas propias vs. adscritas complementarias, cobertura nacional.
11. ESTRUCTURA DE COSTOS COMPARTIDOS:
    - Copagos, Deducibles y Cuotas Moderadoras: valor por consulta o procedimiento en COP o SMMLV, tope anual de desembolso del usuario.
12. CUMPLIMIENTO NORMATIVO (Res. 244/2019 MinSalud · Ley 1438/2011 Art. 13):
    - Portabilidad: ¿el plan garantiza portabilidad nacional entre ciudades? ¿aplica continuidad de períodos de carencia bajo Ley 1438?
    - Carencias regulatorias: días/meses de carencia por tipo de cobertura (general, maternidad, ortodoncia, preexistencias).

REGLAS CRÍTICAS DE EXTRACCIÓN:
- NO inventes coberturas, valores ni condiciones.
- Si un campo no aparece en la cotización, usa null o "NO ESPECIFICADO".
- Para cada cobertura incluye rawTextSnippet (texto exacto de 50-150 caracteres) y pageNumber (página donde aparece).
- Pon especial atención a los copagos y límites anuales de desembolso.
- Registra si el plan es COMPLEMENTARIO (adicional al POS/EPS obligatorio) o SUSTITUTIVO (reemplaza EPS).
- Para normatividad: indica explícitamente si el plan menciona cumplimiento Res. 244/2019 y portabilidad (Ley 1438).`;

const SALUD_FORMAT_INSTRUCTIONS = `FORMATO DE SALIDA (JSON):
{
  "insurerName": "Nombre Aseguradora",
  "policyName": "Plan de Salud / Medicina Prepagada Premium",
  "planType": "COMPLEMENTARIO | SUSTITUTIVO",
  "premium": {
    "netPremium": 350000,
    "fees": 0,
    "taxes": 66500,
    "totalPayable": 416500,
    "currency": "COP",
    "periodicity": "MENSUAL"
  },
  "regulatoryCompliance": {
    "res244_2019": true,
    "portabilityLaw1438": true,
    "generalWaitingPeriodDays": 90,
    "maternityWaitingPeriodMonths": 10,
    "orthodonticsWaitingPeriodMonths": 6,
    "notes": "Plan certificado ante MinSalud bajo Resolución 244 de 2019"
  },
  "preexistingConditions": {
    "handling": "EXCLUSION | ACEPTACION_CON_CARENCIA | DECLARACION_JURADA",
    "waitingPeriodMonths": 6,
    "notes": "Sujeto a evaluación médica previa"
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS HOSPITALARIAS",
      "rawName": "Hospitalización y Cirugía",
      "insuredAmount": null,
      "limit": "365 días al año en habitación privada individual",
      "copayment": "10% del valor del servicio hasta 1 SMMLV",
      "deductible": null,
      "notes": "Incluye cama de acompañante y UCI sin límite",
      "rawTextSnippet": "...",
      "pageNumber": 1
    },
    {
      "section": "ENFERMEDADES DE ALTO COSTO",
      "rawName": "Oncología (Tratamientos de Alto Costo)",
      "insuredAmount": 500000000,
      "limit": "Sin límite de sesiones para quimioterapia y radioterapia",
      "copayment": "Sin copago",
      "deductible": null,
      "notes": "Incluye medicamentos oncológicos e inmunoterapia",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "providerNetwork": {
    "ownClinicCount": 12,
    "cities": ["Bogotá", "Medellín", "Cali", "Barranquilla"],
    "hasComplementaryNetwork": true,
    "notes": "Acceso directo a más de 3.000 especialistas adscritos"
  },
  "specialConditions": [],
  "exclusions": []
}`;

const SALUD_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Salud / Medicina Prepagada quote extraction schema compliant with MinSalud Res. 244/2019',
  additionalProperties: true,
  properties: {
    insurerName: { type: 'string' },
    policyName: { type: 'string' },
    planType: { type: 'string', nullable: true },
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
    regulatoryCompliance: {
      type: 'object',
      additionalProperties: true,
      properties: {
        res244_2019: { type: 'boolean', nullable: true },
        portabilityLaw1438: { type: 'boolean', nullable: true },
        generalWaitingPeriodDays: { type: 'number', nullable: true },
        maternityWaitingPeriodMonths: { type: 'number', nullable: true },
        orthodonticsWaitingPeriodMonths: { type: 'number', nullable: true },
        notes: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    preexistingConditions: {
      type: 'object',
      additionalProperties: true,
      properties: {
        handling: { type: 'string', nullable: true },
        waitingPeriodMonths: { type: 'number', nullable: true },
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
          limit: { type: 'string', nullable: true },
          copayment: { type: 'string', nullable: true },
          deductible: { type: 'string', nullable: true },
          notes: { type: 'string', nullable: true },
          rawTextSnippet: { type: 'string', nullable: true },
          pageNumber: { type: 'number', nullable: true },
        },
      },
      nullable: true,
    },
    providerNetwork: {
      type: 'object',
      additionalProperties: true,
      properties: {
        ownClinicCount: { type: 'number', nullable: true },
        cities: { type: 'array', items: { type: 'string' }, nullable: true },
        hasComplementaryNetwork: { type: 'boolean', nullable: true },
        notes: { type: 'string', nullable: true },
      },
      nullable: true,
    },
    specialConditions: { type: 'array', items: { type: 'string' }, nullable: true },
    exclusions: { type: 'array', items: { type: 'string' }, nullable: true },
  },
};

function buildSaludPrompt(contextNote?: string): string {
  let prompt = `${SALUD_BASE_PROMPT}\n\n${SALUD_FORMAT_INSTRUCTIONS}`;

  if (contextNote) {
    prompt += `\n\nCONTEXTO ADICIONAL:\n${contextNote}`;
  }

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (netPremium, fees, taxes, totalPayable, insuredAmount) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 416500 para $416.500 COP).

2. PORCENTAJES Y COSTOS COMPARTIDOS:
   - En campos de copagos, deducibles o notas con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "10%", "10% del servicio").
   - Preservar las unidades colombianas de copagos y deducibles: COP, SMMLV (Salario Mínimo Mensual Legal Vigente), o "Sin copago".

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Plan de Beneficios Base", "Hospitalización y Cirugía", "Consulta Médica Especialista", "Oncología (Tratamientos de Alto Costo)", "Maternidad y Neonatología", "Salud Mental y Psiquiatría", "Hospitalización Domiciliaria y Atención en Casa").

4. MARCO NORMATIVO COLOMBIANO:
   - Registrar la conformidad con la Resolución 244 de 2019 de Ministerio de Salud, la Ley 1438 de 2011 (portabilidad) y el esquema PVS en Colombia.

### GROUNDING RULES (REQUIRED)

For every coverage row you emit:
1. rawTextSnippet MUST be a contiguous substring of 50-150 characters copied verbatim from the PDF.
2. pageNumber MUST be the 1-based page number where that substring appears.
3. If you cannot locate the coverage in the PDF, set the coverage value to "NO ESPECIFICADO" and still provide your best snippet + page.
4. Do NOT invent snippet text.

### ANTI-HALLUCINATION RULES

- If a field is not present in the document, use "NO ESPECIFICADO" (for text) or null/0 (for numbers).
- Premium totalPayable must match a visible total in the PDF.
- planType must be explicitly stated in the document; do NOT infer.
- regulatoryCompliance fields must be based on explicit document statements; do NOT assume compliance.

INSTRUCCIONES FINALES:
1. Extraer TODA la información disponible.
2. NO inventar valores ni declarar cumplimiento normativo no explícito.
3. Devolver SOLO el JSON, sin texto adicional.`;

  return prompt;
}

export const saludPromptStrategy: PromptStrategy = {
  buildPromptForFamily: (_family: FormatFamily, context?: PromptContext): string => {
    const notes: string[] = [];
    if (context?.pageCount) notes.push(`El documento tiene ${context.pageCount} páginas.`);
    if (context?.hasTables) notes.push('El documento contiene tablas.');
    if (context?.insurerName) notes.push(`Aseguradora detectada: ${context.insurerName}.`);
    if (context?.formatFamily) notes.push(`Format family: ${context.formatFamily}.`);
    return buildSaludPrompt(notes.length > 0 ? notes.join('\n') : undefined);
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
    return buildSaludPrompt(contextNote);
  },

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción de SALUD / MEDICINA PREPAGADA requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "planType", "premium"
- "regulatoryCompliance" con datos de Res. 244/2019 y portabilidad Ley 1438
- "preexistingConditions" con método de manejo y período de carencia
- "rawCoverages" con rawName, limit, copayment, deductible, rawTextSnippet y pageNumber
- "providerNetwork" con ciudades y número de clínicas propias
- "specialConditions" y "exclusions"

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => SALUD_RESPONSE_SCHEMA,
};
