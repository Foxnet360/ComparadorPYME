import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const CUMPLIMIENTO_BASE_PROMPT = `Eres un extractor experto de PÓLIZAS DE CUMPLIMIENTO, FIANZAS Y GARANTÍAS CONTRACTUALES en Colombia bajo el Estatuto General de Contratación Pública (Ley 80 de 1993), el Decreto 1082 de 2015 (SECOP) y la reglamentación de la Superintendencia Financiera de Colombia (SFC).

Extrae la información de las pólizas de cumplimiento considerando las siguientes secciones y marco normativo colombiano:
1. DATOS DE LA PÓLIZA Y DEL CONTRATO: aseguradora, nombre del producto, tipo de póliza ("CUMPLIMIENTO", "MANEJO", "TRC", "MIXTA"), tomador/afianzado (contratista), beneficiario (entidad pública o contratante privado), objeto y número del contrato garantizado, valor total del contrato en COP.
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (19%), totalPayable, currency ("COP"), periodicity ("ANUAL" o "POR_VIGENCIA_DE_CONTRATO").
3. GARANTÍAS PRECONTRACTUALES:
   - Seriedad de Oferta: suma asegurada y % sobre el valor de la propuesta u oferta (mínimo 10% según Decreto 1082/2015).
4. GARANTÍAS DE EJECUCIÓN (Amparos del contrato vigente):
   - Cumplimiento del Contrato: suma asegurada y % sobre el valor total del contrato (típicamente 10% a 20%).
   - Correcta Inversión del Anticipo: suma asegurada equivalente al 100% del valor del anticipo otorgado.
   - Salarios, Prestaciones Sociales e Indemnizaciones Laborales: suma asegurada y % sobre valor del contrato (típicamente 5% a 15%).
5. GARANTÍAS POST-CONTRACTUALES:
   - Estabilidad y Calidad de la Obra: suma asegurada, % y término de vigencia post-entrega (ej. 5 años post-acta de entrega).
   - Calidad del Bien o Servicio: suma asegurada y vigencia post-entrega de bienes o servicios.
   - Garantía de Mantenimiento (Post-Obra / Post-Contrato): amparo de obligaciones de mantenimiento preventivo y correctivo.
6. GARANTÍAS DE RESPONSABILIDAD:
   - Pago de Daños a Terceros (RC Contractual): suma asegurada para responder por daños causados durante la ejecución.
   - Responsabilidad Civil Extracontractual (RCE) durante ejecución: suma asegurada RCE.
7. GARANTÍAS DE MANEJO Y FIDELIDAD:
   - Buen Manejo y Correcta Inversión de Bienes: suma asegurada por bienes entregados al contratista.
   - Manejo de Empleados (Fidelidad Colectiva): suma asegurada por actos deshonestos del personal.
   - Manejo Individual (Fidelidad / Forgery): cargo específico y suma asegurada.
8. COBERTURAS DE OBRA (si aplica TRC / TRM):
   - Todo Riesgo Construcción / Montaje: suma asegurada de la obra y equipos.
9. CONDICIONES GENERALES Y VIGENCIA:
   - Vigencia, Plazo y Condiciones del Amparo: fechas inicio/fin por cada amparo, condiciones de prórroga automática o suspensión.
10. CUMPLIMIENTO NORMATIVO ESTATAL (Ley 80 de 1993 · Decreto 1082 de 2015 · Ley 1150 de 2007):
    - Garantía Única de Cumplimiento: ¿la póliza ampara contrato estatal bajo Ley 80? ¿está expedida a favor de entidad pública en el SECOP? ¿cumple los porcentajes mínimos exigidos por el Decreto 1082/2015?

REGLAS CRÍTICAS DE EXTRACCIÓN:
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
    "notes": "Póliza de Garantía Única expedida a favor de entidad estatal bajo Ley 80/1993 y Decreto 1082/2015 en SECOP"
  },
  "rawCoverages": [
    {
      "section": "GARANTÍAS DE EJECUCIÓN",
      "rawName": "Cumplimiento de Contrato",
      "insuredAmount": 50000000,
      "percentageOfContract": "10%",
      "validityStart": "2024-01-01",
      "validityEnd": "2025-01-01",
      "notes": "Ampara el cumplimiento oportuno del objeto contractual",
      "rawTextSnippet": "...",
      "pageNumber": 1
    },
    {
      "section": "GARANTÍAS DE EJECUCIÓN",
      "rawName": "Correcta Inversión del Anticipo",
      "insuredAmount": 100000000,
      "percentageOfContract": "100%",
      "validityStart": "2024-01-01",
      "validityEnd": "2025-01-01",
      "notes": "100% del valor pactado como anticipo",
      "rawTextSnippet": "...",
      "pageNumber": 1
    }
  ],
  "generalConditions": {
    "hasAutomaticRenewal": false,
    "renewalConditions": "Sujeto a adición o prórroga del contrato principal",
    "cancellationNoticeDays": 30
  },
  "specialConditions": [],
  "exclusions": []
}`;

const CUMPLIMIENTO_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description: 'Cumplimiento / Fianzas quote extraction schema under Ley 80/1993 and Decreto 1082/2015',
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

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (contractValue, netPremium, fees, taxes, totalPayable, insuredAmount) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 500000000 para $500.000.000 COP).

2. PORCENTAJES SOBRE EL CONTRATO Y DEDUCIBLES:
   - En campos "percentageOfContract" o notas con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "10%", "100%", "10% del valor del contrato").
   - Preservar las unidades colombianas de amparos o deducibles: SMMLV (Salario Mínimo Mensual Legal Vigente), % del valor del contrato, % del anticipo, o valor fijo en COP.

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Seriedad de Oferta", "Cumplimiento de Contrato", "Correcta Inversión del Anticipo", "Salarios, Prestaciones e Indemnizaciones Laborales", "Estabilidad y Calidad de Obra", "Garantía Única de Cumplimiento").

4. MARCO NORMATIVO COLOMBIANO (CONTRATACIÓN ESTATAL):
   - Registrar explícitamente el cumplimiento del Estatuto General de Contratación Pública (Ley 80 de 1993) y del Decreto 1082 de 2015 (SECOP) para amparos ante entidades estatales en contratación pública colombiana.

### GROUNDING RULES (REQUIRED)

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
