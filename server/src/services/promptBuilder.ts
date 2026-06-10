/**
 * Prompt Builder Service
 * Builds specialized extraction prompts based on format family
 */

import { FormatFamily } from './formatDetector';

interface PromptTemplate {
  family: FormatFamily;
  basePrompt: string;
  formatInstructions: string;
  fewShotExamples: string;
}

const PROMPT_TEMPLATES: Record<FormatFamily, PromptTemplate> = {
  'TABLE-DOUBLE': {
    family: 'TABLE-DOUBLE',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Tabla Doble":
- Página 1: Tabla "AMPAROS Y COBERTURAS" con Descripción y Suma Asegurada
- Página 2: Tabla separada "DEDUCIBLES QUE APLICAN" por tipo de amparo
- Página 3+: Detalle de riesgos con bienes asegurados desglosados

REGLAS CRÍTICAS:
1. EXTRAER TODAS las filas de la tabla de coberturas de la página 1
2. Los deducibles NO están en la tabla de coberturas, están en la página 2 - REVISAR TODAS LAS PÁGINAS
3. Relaciona deducibles generales con coberturas por el nombre de la sección
4. Si una cobertura no tiene deducible específico, busca en la tabla de deducibles generales de la página 2
5. IMPORTANTE: Si no encuentras deducible en ninguna página, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en cláusulas
6. EXTRAER primas por cobertura si aparecen (algunas cotizaciones las muestran)
7. La sección "RESPONSABILIDAD CIVIL" tiene sub-límites que van en subLimits
8. Los valores "INCLUIDO" son coberturas sin suma asegurada numérica`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "nombre exacto",
  "policyName": "nombre del producto",
  "premium": {
    "netPremium": 4517581,
    "fees": 0,
    "taxes": 858340,
    "otherCharges": 0,
    "totalPayable": 5375921,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "insuredAssets": [
    { "assetType": "EDIFICIOS", "value": 440000000, "notes": "" }
  ],
  "rawCoverages": [
    {
      "section": "DAÑOS MATERIALES",
      "rawName": "Incendio y Riesgos Aliados",
      "insuredAmount": 696700000,
      "deductible": "5% del valor de la pérdida, mínimo 1 SMMLV",
      "premium": null,
      "notes": ""
    }
  ],
  "subLimits": [],
  "generalDeductibles": [
    { "appliesTo": "AMPAROS BASICOS", "deductibleText": "5% del valor de la pérdida, mínimo 1 SMMLV" }
  ]
}`,
    fewShotExamples: `EJEMPLO TABLA DOBLE:
Entrada: "AMPAROS Y COBERTURAS" tabla con "Incendio y Riesgos Aliados" = $696,700,000
Página 2: "DEDUCIBLES QUE APLICAN: AMPAROS BASICOS: 5% del valor de la pérdida, mínimo 1 SMMLV"
Salida: rawName="Incendio y Riesgos Aliados", insuredAmount=696700000, deductible="5% del valor de la pérdida, mínimo 1 SMMLV`,
  },

  'TABLE-INTEGRATED': {
    family: 'TABLE-INTEGRATED',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Tabla Integrada":
- Tabla única con columnas: Descripción | Suma Asegurada | Deducible
- Incluye coberturas principales Y sub-límites (marcados con "(Sublímite)")
- Al final: Desglose de prima en tabla separada

REGLAS CRÍTICAS:
1. Extraer TODAS las filas de la tabla, incluyendo las marcadas "(Sublímite)"
2. Los sub-límites van en el array subLimits con parentCoverage
3. REVISAR TODAS LAS PÁGINAS del documento para encontrar deducibles (pueden estar en sección de condiciones o cláusulas)
4. Deducibles que dicen "$ 0,00 No aplica Deducible" → deductible: "No aplica"
5. Deducibles que dicen "5,00 % del Siniestro, Mínimo 1 SMMLV" → dejar texto completo
6. Coberturas que dicen "Aplica según cobertura afectada" → nota especial
7. El "Amparo Básico Todo Riesgo" cubre múltiples coberturas
8. IMPORTANTE: Si no encuentras deducible en ninguna página, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en cláusulas`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "Todo Riesgo Daño Material PYMES",
  "premium": {
    "netPremium": 9005824,
    "fees": 12000,
    "taxes": 1713386,
    "otherCharges": 0,
    "totalPayable": 10731210,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rawCoverages": [
    {
      "section": "DAÑOS MATERIALES",
      "rawName": "AMPARO BÁSICO TODO RIESGO DE PÉRDIDA O DAÑO MATERIAL",
      "insuredAmount": 1621704283,
      "deductible": "5,00 % del Siniestro, Mínimo 1 SMMLV",
      "premium": null
    }
  ],
  "subLimits": [
    {
      "parentCoverage": "AMPARO BÁSICO TODO RIESGO DE PÉRDIDA O DAÑO MATERIAL",
      "name": "Remoción de escombros",
      "limit": 486511284,
      "deductible": "No aplica"
    }
  ]
}`,
    fewShotExamples: `EJEMPLO TABLA INTEGRADA:
Entrada: Tabla con "AMPARO BÁSICO" | 1.621.704.283,00 COP | 5,00 % del Siniestro, Mínimo 1 SMMLV
Salida: rawName="AMPARO BÁSICO TODO RIESGO DE PÉRDIDA O DAÑO MATERIAL", insuredAmount=1621704283, deductible="5,00 % del Siniestro, Mínimo 1 SMMLV`,
  },

  'SECTIONS': {
    family: 'SECTIONS',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Secciones Numeradas":
- Secciones numeradas: "SECCION PRIMERA", "SECCION SEGUNDA", etc.
- Cada sección tiene: nombre, valor asegurado, deducible, descripción
- Un valor asegurado puede aplicar a múltiples coberturas

REGLAS CRÍTICAS:
1. Extraer cada sección como una rawCoverage
2. El valor asegurado de la sección aplica a TODAS las coberturas de esa sección
3. Analizar la descripción para identificar coberturas incluidas
4. Ejemplo: "SECCION PRIMERA - AMPARO BASICO" incluye Incendio, Explosión, etc.
5. Los deducibles están en formato "10 % PERD Min 1 (SMMLV)"
6. REVISAR TODAS LAS PÁGINAS para deducibles - cada sección puede tener su propio deducible
7. IMPORTANTE: Si no encuentras deducible, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en cláusulas finales`,
    formatInstructions: `FORMATO DE SALIDA:\n{\n  "insurerName": "NOMBRE ASEGURADORA",\n  "policyName": "TODO RIESGO PYME INTEGRAL",
  "premium": {
    "netPremium": 0,
    "fees": 0,
    "taxes": 0,
    "otherCharges": 0,
    "totalPayable": 0,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rawCoverages": [
    {
      "section": "SECCION PRIMERA",
      "rawName": "AMPARO BASICO - TODO RIESGO DANO MATERIAL",
      "insuredAmount": 119600000,
      "deductible": "10 % PERD Min 1 (SMMLV)",
      "notes": "Incluye: Incendio, Explosión, Daños por agua, Anegación, Deslizamiento, Avalancha"
    }
  ]
}`,
    fewShotExamples: `EJEMPLO SECCIONES NUMERADAS:
Entrada: "SECCION PRIMERA - AMPARO BASICO - TODO RIESGO DANO MATERIAL" = $119,600,000
Salida: section="SECCION PRIMERA", rawName="AMPARO BASICO - TODO RIESGO DANO MATERIAL", insuredAmount=119600000`,
  },

  'DESCRIPTIVE': {
    family: 'DESCRIPTIVE',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Descriptivo":
- Texto corrido con párrafos descriptivos de cada cobertura
- Sección "Bienes y Valores Asegurables" con tabla de activos
- Prima desglosada al inicio

REGLAS CRÍTICAS:
1. Extraer bienes asegurables de la tabla (Inmuebles, Muebles, Maquinaria, etc.)
2. Leer cada párrafo descriptivo para identificar coberturas
3. El valor asegurado total está en la carátula
4. Distribuir valores de bienes asegurables entre coberturas según corresponda
5. REVISAR TODAS LAS PÁGINAS para deducibles - buscar en cláusulas, condiciones especiales, y anexos
6. IMPORTANTE: Si no encuentras deducible, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en sección de deducibles`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "PYME SEGURA",
  "premium": {
    "netPremium": 10343085,
    "fees": 0,
    "taxes": 1965186,
    "otherCharges": 0,
    "totalPayable": 12308271,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "insuredAssets": [
    { "assetType": "Inmuebles", "value": 895832342 },
    { "assetType": "Muebles y enseres", "value": 102807783 },
    { "assetType": "Maquinaria", "value": 223064158 }
  ],
  "rawCoverages": [
    {
      "rawName": "Todo riesgo incendio",
      "insuredAmount": 3235531256,
      "deductible": null,
      "notes": "Cubre incendio, rayo, explosión, daños por agua, etc."
    }
  ]
}`,
    fewShotExamples: `EJEMPLO DESCRIPTIVO:
Entrada: "Valor asegurado: $3,235,531,256" + "Inmuebles: $895,832,342"
Salida: insuredAssets=[{assetType:"Inmuebles", value:895832342}], rawCoverages=[{rawName:"Todo riesgo incendio", insuredAmount:3235531256}]`,
  },

  'PRICE-TABLE': {
    family: 'PRICE-TABLE',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Tabla de Primas":
- Tabla "Resumen de coberturas y primas" con coberturas y sus primas
- Muestra PRIMAS por cobertura, NO valores asegurados
- Desglose de impuestos al final

REGLAS CRÍTICAS:
1. Esta cotización muestra PRIMAS por cobertura, no valores asegurados
2. Extraer la prima de cada cobertura
3. El valor asegurado puede no estar visible - dejar como null
4. Extraer impuestos (IVA) desglosados
5. REVISAR TODAS LAS PÁGINAS para deducibles - pueden estar en columna separada de la tabla o en cláusulas
6. IMPORTANTE: Si no encuentras deducible, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en sección de condiciones
7. La prima total es la suma de primas + impuestos`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "SEGURO INTEGRAL PARA LA EMPRESA",
  "premium": {
    "netPremium": 4584105,
    "fees": 0,
    "taxes": 0,
    "otherCharges": 0,
    "totalPayable": 4584105,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rawCoverages": [
    {
      "rawName": "Todo riesgo daños materiales",
      "insuredAmount": null,
      "deductible": null,
      "premium": 485151
    }
  ]
}`,
    fewShotExamples: `EJEMPLO TABLA DE PRIMAS:
Entrada: "Todo riesgo daños materiales | PRIMA $485,151 | IMPUESTOS $92,179"
Salida: rawName="Todo riesgo daños materiales", premium=485151, insuredAmount=null`,
  },

  'CONDITIONS': {
    family: 'CONDITIONS',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene el formato "Condiciones del Contrato":
- Es un documento de condiciones contractuales, no una tabla de cotización
- Secciones numeradas (7, 8, 9...) con descripciones de coberturas
- Coberturas listadas con bullets (✓) o viñetas
- Valor asegurado total en el encabezado, no por cobertura individual
- Deducibles en secciones separadas o en el clausulado

REGLAS CRÍTICAS:
1. EXTRAER cada bullet/viñeta como una cobertura individual
2. Usar el nombre de la sección como contexto (ej: "Todo Riesgo Daño Material")
3. Si una cobertura dice "Incluye: X, Y, Z", extraer X, Y, Z como coberturas separadas
4. El valor asegurado total está en el encabezado - usarlo como insuredAmount general
5. Si no hay valor individual, usar el total o dejar como null con nota "Incluido en base"
6. REVISAR TODAS LAS PÁGINAS para deducibles - buscar en secciones de "Deducibles" o "Condiciones Especiales"
7. IMPORTANTE: Si no encuentras deducible en el documento, usa "Ver clausulado" - los deducibles están en el clausulado separado
8. Extraer sub-límites mencionados (ej: "sublimitado al 100%")
9. Los servicios (Asistencia, Legal) usualmente no tienen deducible`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "NOMBRE PRODUCTO",
  "premium": {
    "netPremium": 16409171,
    "fees": 0,
    "taxes": 3117742,
    "otherCharges": 0,
    "totalPayable": 19526913,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rawCoverages": [
    {
      "section": "Todo Riesgo Daño Material",
      "rawName": "Incendio y/o rayo o sus efectos inmediatos",
      "insuredAmount": 16409171035,
      "deductible": "Ver clausulado",
      "notes": "Incluido en Todo Riesgo"
    }
  ],
  "subLimits": [
    {
      "parentCoverage": "Todo Riesgo Daño Material",
      "name": "Hurto calificado",
      "limit": 1363951301,
      "deductible": "Ver clausulado"
    }
  ],
  "generalDeductibles": [
    { "appliesTo": "Daños Materiales", "deductibleText": "Ver clausulado" }
  ]
}`,
    fewShotExamples: `EJEMPLO CONDICIONES DEL CONTRATO:
Entrada: Sección 8 "Todo riesgo daño material incluyendo: ✓ Incendio, ✓ Terremoto, ✓ Daño interno"
Salida: rawName="Incendio", section="Todo Riesgo Daño Material", insuredAmount=16409171035, deductible="Ver clausulado"`,
  },

  'TEXT': {
    family: 'TEXT',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene un formato de texto corrido o carta:
- No tiene tabla clara de coberturas
- La información está dispersa en el documento
- Puede tener múltiples páginas con información diferente

REGLAS CRÍTICAS:
1. Buscar coberturas en TODO el documento
2. La prima está desglosada: VALOR DE LA PRIMA + ASISTENCIA + EMISIÓN + IVA = TOTAL
3. Extraer TODOS los componentes del desglose
4. Buscar valores asegurados en cualquier parte
5. REVISAR TODAS LAS PÁGINAS para deducibles - buscar en cláusulas, condiciones especiales, y páginas finales
6. IMPORTANTE: Si no encuentras deducible, usa "No aplica" para servicios (Asistencia PYME, Legal) o busca en sección de condiciones`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "NOMBRE PRODUCTO",
  "premium": {
    "netPremium": 1187511,
    "fees": 8000,
    "taxes": 227147,
    "otherCharges": 73000,
    "totalPayable": 1509528,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "rawCoverages": [
    {
      "rawName": "Protección",
      "insuredAmount": 321000000,
      "deductible": null
    }
  ]
}`,
    fewShotExamples: `EJEMPLO TEXTO CORRIDO:
Entrada: "VALOR DE LA PRIMA: $1,187,511" + "ASISTENCIA: $73,000" + "EMISIÓN DIGITAL: $8,000" + "IVA: $227,147" = "TOTAL: $1,509,528"
Salida: premium={netPremium:1187511, fees:8000, taxes:227147, otherCharges:73000, totalPayable:1509528}`,
  },

  'UNKNOWN': {
    family: 'UNKNOWN',
    basePrompt: `Eres un extractor experto de cotizaciones de seguros PYME colombianos.

Este PDF tiene un formato no reconocido. Extraer toda la información posible siguiendo el schema flexible estándar:
- Nombre de aseguradora y póliza
- Primas y desgloses (netPremium, fees, taxes, otherCharges, totalPayable, currency, periodicity)
- Bienes asegurados (insuredAssets) si aparecen
- Coberturas con valores y deducibles (rawCoverages)
- Sub-límites (subLimits) si existen
- Deducibles generales (generalDeductibles) si existen
- Condiciones especiales, exclusiones y garantías

REGLAS CRÍTICAS:
1. NO inventar coberturas, valores ni deducibles que no estén en el documento
2. Si un campo no está en el documento, usar null o array vacío
3. Si no encuentras deducible, usa "No aplica" para servicios (Asistencia PYME, Legal)
4. Revisar TODAS las páginas antes de marcar un campo como no encontrado`,
    formatInstructions: `FORMATO DE SALIDA:
{
  "insurerName": "NOMBRE ASEGURADORA",
  "policyName": "NOMBRE PRODUCTO",
  "premium": {
    "netPremium": 0,
    "fees": 0,
    "taxes": 0,
    "otherCharges": 0,
    "totalPayable": 0,
    "currency": "COP",
    "periodicity": "ANUAL"
  },
  "insuredAssets": [],
  "rawCoverages": [
    {
      "rawName": "Nombre exacto de la cobertura",
      "insuredAmount": null,
      "deductible": null,
      "premium": null,
      "notes": ""
    }
  ],
  "subLimits": [],
  "generalDeductibles": [],
  "specialConditions": [],
  "exclusions": [],
  "warranties": []
}`,
    fewShotExamples: '',
  },
};

/**
 * Build specialized prompt for format family
 */
export function buildPromptForFamily(
  family: FormatFamily,
  context?: {
    pageCount?: number;
    hasTables?: boolean;
    insurerName?: string;
  }
): string {
  const template = PROMPT_TEMPLATES[family] || PROMPT_TEMPLATES['UNKNOWN'];
  
  let prompt = `${template.basePrompt}\n\n${template.formatInstructions}`;
  
  if (template.fewShotExamples) {
    prompt += `\n\n${template.fewShotExamples}`;
  }
  
  // Add context-specific instructions
  if (context) {
    prompt += '\n\nCONTEXTO ADICIONAL:';
    if (context.pageCount) {
      prompt += `\n- El documento tiene ${context.pageCount} páginas`;
    }
    if (context.hasTables) {
      prompt += '\n- El documento contiene tablas';
    }
    if (context.insurerName) {
      prompt += `\n- Aseguradora detectada: ${context.insurerName}`;
    }
  }
  
  prompt += `\n\nINSTRUCCIONES FINALES:\n1. Extraer TODA la información disponible\n2. NO inventar valores que no estén en el documento\n3. Si un campo no está en el documento, usar null o array vacío\n4. Para cada cobertura en 'rawCoverages', DEBES extraer obligatoriamente en 'rawTextSnippet' un fragmento textual literal continuo de 50 a 100 caracteres adyacente a la cobertura en el PDF de origen. Copia este fragmento de forma exacta y sin modificaciones.\n5. Devolver SOLO el JSON, sin texto adicional`;
  
  return prompt;
}

/**
 * Get all available format families
 */
export function getSupportedFormatFamilies(): FormatFamily[] {
  return Object.keys(PROMPT_TEMPLATES).filter(f => f !== 'UNKNOWN') as FormatFamily[];
}

/**
 * Check if a format family is supported
 */
export function isFormatFamilySupported(family: FormatFamily): boolean {
  return family in PROMPT_TEMPLATES && family !== 'UNKNOWN';
}
