import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

const TRANSPORTE_BASE_PROMPT = `Eres un extractor experto de SEGUROS DE TRANSPORTE DE MERCANCÍAS Y FLETES en Colombia bajo regulación del Decreto 1079 de 2015 (Sector Transporte), el Código de Comercio (Libro V, Arts. 1117–1124) y la reglamentación de la Superintendencia Financiera de Colombia (SFC).

Extrae la información de las pólizas/cotizaciones de transporte considerando las siguientes secciones y marco normativo colombiano e internacional:
1. DATOS DE LA PÓLIZA: aseguradora, nombre del producto, tipo de póliza ("FLOTANTE", "POR_VIAJE", "ABIERTA"), tomador/remitente, ruta (origen–destino), modo de transporte ("TERRESTRE", "MARITIMO", "AEREO", "MULTIMODAL").
2. PRIMA: netPremium, fees/gastos de expedición, taxes/IVA (19%), totalPayable, currency ("COP"), periodicity ("POR_VIAJE", "MENSUAL", "ANUAL"), tasaPorMil (tasa aplicada por mil sobre el valor asegurado si aparece explícitamente).
3. COBERTURAS PRINCIPALES:
   - Daño Material a la Carga (Todo Riesgo o Named Perils): alcance de la cobertura y mercancías aseguradas.
   - Pérdida Total (hurto total, extravío, siniestro total): condiciones y causales.
   - Robo Parcial, Pillaje y Saqueo de la Carga: amparo de pérdidas parciales por hurto en tránsito.
   - Robo y Hurto (con y sin violencia): suma asegurada y condiciones de seguridad requeridas (ej. escolta, GPS, horarios de viaje).
   - Responsabilidad Civil del Transportador: suma asegurada y base legal (Código de Comercio Arts. 1117-1124 / Decreto 1079 de 2015).
4. COBERTURAS MARÍTIMAS Y CLÁUSULAS INTERNACIONALES:
   - Avería Particular y Avería Gruesa (General Average): términos cubiertos y contribución de salvamento.
   - Cláusulas de Carga del Instituto de Londres (ICC - Institute Cargo Clauses A, B o C): especificar si es Cláusula A (Todo Riesgo), B o C.
   - Cláusula de Abandono y Pérdida Total Constructiva (CTL): condiciones para aviso de abandono en transporte marítimo.
5. COBERTURAS ESPECIALES Y DE MERCANCÍA:
   - Refrigeración y Carga Perecedera: temperatura controlada y falla de la cadena de frío.
   - Carga a Granel o Carga Peligrosa: clase ADR / IMDG / IATA, autorizaciones y restricciones de transporte.
6. COBERTURAS COMPLEMENTARIAS:
   - Daño o Pérdida del Contenedor / Embalaje: suma asegurada para contenedores y empaques.
   - Demora en la Entrega y Lucro Cesante: límites y condiciones por retrasos.
7. VALOR ASEGURADO E INCOTERM:
   - Cobertura de Fletes e Impuestos según Incoterm (CIF, FOB, DAP, DDP - Incoterms 2020): valor asegurado declarado y porcentaje de sobre-valor (ej. 110% del valor CIF para cubrir fletes e impuestos de importación).
8. CONDICIONES Y DEDUCIBLES:
   - Deducibles y Franquicias: valor o porcentaje por tipo de siniestro (% del valor asegurado, % de la pérdida, SMMLV o COP).
   - Vigencia y Tipo de Póliza: fechas de vigencia, modalidad (por viaje, flotante, abierta), declaraciones de embarque requeridas.
9. CUMPLIMIENTO NORMATIVO:
   - Marco Normativo (Decreto 1079/2015 · Código de Comercio · Incoterms 2020 · Cláusulas ICC): verificar si la póliza hace referencia explícita a la normatividad colombiana de transporte y reglas internacionales ICC.

REGLAS CRÍTICAS DE EXTRACCIÓN:
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
    "notes": "Cláusula A — Todo Riesgo del Instituto de Londres"
  },
  "regulatoryCompliance": {
    "decreto1079_2015": true,
    "codigoDeComercio": true,
    "incoterms2020": true,
    "notes": "Póliza ajustada a regulación de transporte terrestre y marítimo en Colombia"
  },
  "rawCoverages": [
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Daño Material a la Carga (Todo Riesgo / Named Perils)",
      "insuredAmount": 150000000,
      "deductible": "1% del valor asegurado, mínimo 1 SMMLV",
      "conditions": "",
      "notes": "Ampara pérdidas y daños físicos a la mercancía durante el trayecto",
      "rawTextSnippet": "...",
      "pageNumber": 1
    },
    {
      "section": "COBERTURAS PRINCIPALES",
      "rawName": "Robo y Hurto (Con y Sin Violencia)",
      "insuredAmount": 150000000,
      "deductible": "10% del siniestro",
      "conditions": "Requiere dispositivo GPS activo y vehículo en parqueadero autorizado",
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
  description: 'Transporte de Mercancías quote extraction schema under Decreto 1079/2015 and Incoterms 2020',
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

  prompt += `\n\n### REGLAS DE FORMATO COLOMBIA (ESTÁNDAR DE EXTRACCIÓN OBLIGATORIO)

1. MONEDA Y VALORES MONETARIOS:
   - "currency": "COP" (Pesos Colombianos).
   - Todos los valores monetarios numéricos (insuredValue, netPremium, fees, taxes, totalPayable, insuredAmount) deben ser números enteros o flotantes puros en JS sin puntos de miles, comas ni símbolos "$" (ejemplo: 150000000 para $150.000.000 COP).

2. PORCENTAJES, TASAS E INCOTERMS:
   - En campos "insuredValuePercentage", deducibles o notas con porcentaje, conservar la notación porcentual explícita con "%" (ejemplo: "110%", "1% del valor asegurado").
   - Para "tasaPorMil", registrar el número de tasa aplicado por mil si aparece explícitamente (ejemplo: 10.0 para 10 por mil).
   - Preservar las unidades colombianas de deducibles: SMMLV (Salario Mínimo Mensual Legal Vigente), % del valor asegurado, % de la pérdida, o valor fijo en COP.

3. ORTOGRAFÍA Y TILDES (ESPAÑOL COLOMBIA):
   - Todos los textos de coberturas ("rawName"), secciones ("section"), notas y condiciones deben mantener la ortografía formal en español colombiano con sus tildes correspondientes (ejemplo: "Daño Material a la Carga (Todo Riesgo / Named Perils)", "Pérdida Total de la Carga", "Responsabilidad Civil del Transportador", "Robo y Hurto (Con y Sin Violencia)", "Avería Particular y Avería Gruesa (Marítima)").

4. MARCO NORMATIVO COLOMBIANO E INTERNACIONAL:
   - Registrar explícitamente la normatividad de transporte en Colombia (Decreto 1079 de 2015, Código de Comercio Libro V Arts. 1117-1124), reglas Incoterms 2020 y Cláusulas ICC (A, B o C) cuando aparezcan en la póliza.

### GROUNDING RULES (REQUIRED)

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
