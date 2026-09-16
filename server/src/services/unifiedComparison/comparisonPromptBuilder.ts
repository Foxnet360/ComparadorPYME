/**
 * Comparison Prompt Builder
 * Builds the multimodal prompt for Gemini 3.5 Flash to compare insurance quotes
 * Based on the successful reference prompt from prompt_agente_comparativa_seguros.md
 */

import { UnifiedComparisonSchema } from './comparisonSchema';
import { InsuranceDomain } from '../../types/domain';
import { HOGAR_GRANULAR_SECTIONS } from './hogarPromptStrategy';

export interface PromptContext {
  insurerCount: number;
  hasClauses?: boolean;
  domain?: InsuranceDomain;
}

const FLAT_ROW_LABELS = [
  'Bienes Asegurados',
  'Deducibles',
  'Prima con IVA',
  'Forma de Pago',
] as const;

const GRANULAR_SECTIONS = [
  {
    section: 'BIENES ASEGURADOS',
    rows: [
      'Mercancías',
      'Muebles y enseres',
      'Maquinaria y equipo',
      'Equipo eléctrico y electrónico',
      'Asistencia',
    ],
  },
  {
    section: 'COBERTURAS',
    rows: [
      'Amparo básico todo riesgo',
      'Terremoto',
      'Responsabilidad Civil Extracontractual (RCE)',
      'Lucro Cesante',
      'Rotura de Maquinaria',
      'Equipos eléctricos y electrónicos',
      'Gastos médicos',
      'Asistencia',
      'Vidrios',
      'Manejo global / Infidelidad',
      'Transporte de mercancías',
      'Daños por agua / Anegación',
      'HMACC-AMIT',
      'RC en proceso civil',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Todo Riesgo Incendio',
      'Anegación / Cobertura Extendida',
      'Terremoto',
      'HMACC-AMIT',
      'RCE',
      'Lucro Cesante',
      'Rotura de Maquinaria',
      'Equipos eléctricos y electrónicos',
      'Vidrios',
      'Manejo global / Infidelidad',
      'Transporte de mercancías',
      'Daños por agua / Anegación',
      'Sustracción con Violencia',
    ],
  },
  {
    section: 'SUSTRACCIÓN',
    rows: ['Sustracción con Violencia'],
  },
  {
    section: 'FINANCIAL',
    rows: ['Prima con IVA incluido', 'Gastos de expedición', 'IVA', 'Total prima', 'Forma de pago'],
  },
] as const;

export class ComparisonPromptBuilder {
  /**
   * Build the main flat-table comparison prompt.
   *
   * Asks the model for one column per insurer and exactly four rows. The
   * response can be JSON, Markdown, CSV or key-value; a parser normalizes it
   * afterwards.
   */
  buildComparisonPrompt(context: PromptContext): string {
    const rowList = FLAT_ROW_LABELS.map((label, idx) => `${idx + 1}. ${label}`).join('\n');

    return `Eres un analista de seguros en Colombia. He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y EXACTAMENTE estas filas:
${rowList}

Reglas:
- REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS: El array "insurers" DEBE contener ÚNICA Y EXCLUSIVAMENTE el nombre corporativo de la aseguradora (ejemplos: "ALLIANZ", "SBS", "SURA", "MAPFRE", "BOLÍVAR", "AXA COLPATRIA", "CHUBB", "SEGUROS DEL ESTADO"). NUNCA concatenes el nombre del cliente/asegurado ni el producto en "insurers" ni en "cells[].insurer".
- Copia los valores textualmente como aparecen en cada cotización.
- No agrupes, no normalices a coberturas canónicas y no inventes datos.
- Si una fila no aparece en una cotización, usa "No informado".
- Responde únicamente con JSON válido que cumpla este schema:
{
  "insurers": ["Aseguradora A", ...],
  "rows": [
    {
      "label": "Bienes Asegurados",
      "cells": [
        {"insurer": "Aseguradora A", "value": "..."},
        ...
      ]
    },
    ...
  ]
}

${context.hasClauses ? 'También se proporcionan clausulados para validación; úsalos solo si una fila es ambigua, pero conserva el texto original de la cotización.' : ''}`;
  }

  /**
   * Build the v2 granular comparison prompt.
   *
   * Suggests section-aware sub-rows but explicitly allows the model to omit,
   * add, or rename rows. The response must be JSON with insurers, rows, and
   * optional section metadata.
   */
  buildV2ComparisonPrompt(
    context: PromptContext,
    templateAddons?: string[],
    domain?: InsuranceDomain
  ): string {
    const effectiveDomain = domain ?? context.domain ?? 'pyme';
    const isHogar = effectiveDomain === 'hogar';

    const sectionsToUse = isHogar ? HOGAR_GRANULAR_SECTIONS : GRANULAR_SECTIONS;
    const sectionList = sectionsToUse
      .map((section, sIdx) => {
        const rows = section.rows.map((row, rIdx) => `    ${rIdx + 1}. ${row}`).join('\n');
        return `  ${sIdx + 1}. ${section.section}:\n${rows}`;
      })
      .join('\n\n');

    const roleDescription = isHogar
      ? `Eres un analista experto en seguros de Hogar y Vivienda en Colombia.`
      : `Eres un analista de seguros PYME en Colombia.`;

    const sectionRules = isHogar
      ? `Reglas de Negocio para Secciones de Hogar:
1. BIENES ASEGURADOS: Identifica la tipología contratada en cada cotización: Solo Edificio/Estructura, Solo Contenidos (Muebles y Enseres) o Integral (Edificio + Contenidos).
   - Si una cotización NO ampara el Edificio (ej. póliza para arrendatario), usa exactamente "No Cotizado" para el Edificio.
   - Si una cotización NO ampara Contenidos (ej. seguro obligatorio hipotecario solo estructura), usa exactamente "No Cotizado" para Contenidos.
   - Extrae también valores de Contenidos Especiales (joyas, arte) y Equipo Eléctrico/Electrónico si figuran en la propuesta.
2. COBERTURAS: Extrae límites, amparos y condiciones para Incendio/Rayo/Explosión, Terremoto/Temblor/Erupción, Daños por Agua/Anegación, Granizo/Vendaval, Sustracción con Violencia dentro del predio, RCE Familiar y Asistencia Domiciliaria. Si una cobertura opcional no fue contratada, usa "No Incluido".
3. DEDUCIBLES: Extrae los deducibles específicos por amparo textualmente:
   - Considera la tipología contratada: si un bien no está cotizado (ej. Edificio en póliza solo contenidos), los deducibles asociados a dicho bien deben reportar "No Aplica (Edificio no cotizado)". Si Contenidos no está cotizado (ej. póliza solo edificio), reporta "No Aplica (Contenidos no cotizados)".
   - Terremoto y Sismo: suele expresarse como % del valor asegurable o % de la pérdida con mínimo en SMMLV.
   - Daños por agua, Anegación y Hurto: suele ser % de la pérdida con mínimo en SMMLV.
   - RCE y Asistencia Domiciliaria: si no aplican copago o deducible, reporta textualmente "Sin deducible". NUNCA uses "No Incluido" en la sección de deducibles si el amparo no tiene deducible; usa "Sin deducible".
4. FINANCIAL: Extrae Prima con IVA incluido, Gastos de expedición, IVA, Total prima, y Forma de pago.
   - REGLA CRÍTICA DE SEPARACIÓN PATRIMONIAL VS PRIMA: NUNCA confundas el "Valor Asegurado", "Suma Asegurada" o "Valor Total Asegurado" (que son sumas del inmueble/bienes del orden de cientos o miles de millones de COP) con la Prima o Valor a pagar de la póliza (que para Hogar suele ser de unos pocos millones de COP, ej. $1.000.000 a $15.000.000 COP).
   - La sección FINANCIAL DEBE contener ÚNICA Y EXCLUSIVAMENTE los costos o primas comerciales a pagar por el cliente. Jamás traslades valores de bienes o sumas aseguradas a esta sección ni a la fila "Total a pagar" o "Total prima".
   - Para Allianz: ubica la prima comercial del plan cotizado (ej. "Hogar Esencial", "Hogar Plus") o el "Valor a pagar" / "Total liquidación", extrayendo dicho monto exacto (ej. $3.962.567) en la fila "Total a pagar" o "Total prima".
   - Para Mapfre: ubica la "Prima Total" o "Total a pagar" con IVA incluido (ej. $4.333.254) y repórtala en "Total a pagar" o "Total prima".`
      : `Reglas de Negocio para Secciones:
1. BIENES ASEGURADOS: Extrae las sumas aseguradas o descripciones de Mercancías, Muebles y enseres, Maquinaria y equipo, Equipo eléctrico y electrónico, y Asistencia.
2. COBERTURAS: Extrae límites, amparos y condiciones de cobertura para Amparo básico todo riesgo, Terremoto, Responsabilidad Civil Extracontractual (RCE), Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Gastos médicos, Asistencia, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, HMACC-AMIT, y RC en proceso civil.
3. DEDUCIBLES: Extrae los deducibles específicos para Todo Riesgo Incendio, Anegación / Cobertura Extendida, Terremoto, HMACC-AMIT, RCE, Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, y Sustracción con Violencia. Debes incluir una fila por cada deducible que aparezca textualmente en las cotizaciones; no omitas deducibles. Si un amparo no tiene deducible, usa "Sin deducible".
4. SUSTRACCIÓN: Extrae límites y condiciones para Sustracción con Violencia.
5. FINANCIAL: Extrae Prima con IVA incluido, Gastos de expedición, IVA, Total prima, y Forma de pago. NUNCA coloques sumas aseguradas ni valores de bienes en esta sección; solo costos o primas de la póliza.`;

    const percentageRule = isHogar
      ? `\n- REGLA CRÍTICA DE AMPAROS PORCENTUALES (SURA Y SIMILARES): Si una cotización expresa el valor o límite de una cobertura como un porcentaje (ej. "100%", "10% hasta 50 SMMLV"), DEBES calcular y mostrar el valor monetario real en pesos con base en la suma asegurada del bien correspondiente (Edificio o Contenidos) y reportarlo como "$XXX.XXX.XXX (YY%)". NUNCA dejes únicamente "100%" sin el valor monetario absoluto si la cotización indica el valor asegurable del bien.`
      : '';

    let prompt = `${roleDescription} He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y filas agrupadas por sección. A continuación te sugiero filas granulares, pero PUEDES agregar o renombrar filas según lo que aparezca textualmente en cada cotización. No omitas una fila si la información existe en al menos una cotización.

${sectionList}

${sectionRules}

Reglas Generales:
- REGLA CRÍTICA DE IDENTIFICACIÓN DE ASEGURADORAS: El array "insurers" DEBE contener ÚNICA Y EXCLUSIVAMENTE el nombre corporativo de la aseguradora (ejemplos: "ALLIANZ", "SBS", "SURA", "MAPFRE", "BOLÍVAR", "AXA COLPATRIA", "CHUBB", "SEGUROS DEL ESTADO"). NUNCA concatenes el nombre del cliente/asegurado (ej. "ISABEL CRISTINA VASCO") ni el ramo/producto ("HOGAR", "PYME") dentro de "insurers" ni en el campo "insurer" de las celdas.
- HOMOGENEIZACIÓN DE CONCEPTOS:
  * Usa "No Cotizado" cuando un bien patrimonial (ej. Edificio o Contenido) no fue incluido en el alcance de la cotización.
  * Usa "No Incluido" cuando una cobertura u opción ofrecida por el producto no fue contratada en esta propuesta.
  * Usa "Sin deducible" en la sección de deducibles cuando el amparo no tenga copago a cargo del asegurado.
  * Usa "No Aplica (Edificio no cotizado)" o "No Aplica (Contenidos no cotizados)" en deducibles cuando el bien base no forma parte del seguro.
- REGLA CRÍTICA DE COMPLETITUD: DEBES EXTRAER EL 100% DE LAS COBERTURAS, BIENES, DEDUCIBLES Y CONDICIONES PRESENTES EN LAS COTIZACIONES. NO OMITAS NINGUNA FILA POR RESUMEN O LÍMITE DE ESPACIO. SI EXISTEN 30 O 40 AMPAROS, GENERA LAS 30 O 40 FILAS EN EL JSON.
- REGLA DE INTEGRIDAD NUMÉRICA: Conserva intactos los montos, monedas (COP/USD), símbolos y separadores de miles/decimales. Si una cifra dice "$ 15.000.000,00" o "$ 15,000,000.00", déjala tal cual sin alterar ni mover los puntos o comas.${percentageRule}
- CITA DE PÁGINA: Extrae obligatoriamente en pageNumber el número de página exacto (1-indexado) donde figura la información dentro de la cotización.
- Copia los valores textualmente como aparecen en cada cotización.
- No agrupes, no normalices a coberturas canónicas y no inventes datos.
- Si una fila no aparece en una cotización, usa "No informado".
- Para rawText (evidencia), incluye un snippet breve (50-300 caracteres) SOLO cuando exista información o cobertura. No incluyas textos extensos en celdas sin amparo.
- Además, para cada cotización, extrae los siguientes metadatos de cabecera: Cliente, Tipo de Seguro, Ubicación del Riesgo, Año Construcción, Pisos, Aliado, Actividad/Ocupación, Documento, Vigencia.
- Responde únicamente con JSON válido que cumpla este schema:
{
  "insurers": ["Aseguradora A", ...],
  "quoteMetadata": [
    {
      "insurer": "Aseguradora A",
      "cliente": "...",
      "tipoSeguro": "...",
      "ubicacionRiesgo": "...",
      "anoConstruccion": "...",
      "pisos": "...",
      "aliado": "...",
      "actividadOcupacion": "...",
      "documento": "...",
      "vigencia": "..."
    },
    ...
  ],
  "rows": [
    {
      "label": "Edificio / Estructura",
      "section": "BIENES ASEGURADOS",
      "cells": [
        {"insurer": "Aseguradora A", "value": "...", "rawText": "...", "pageNumber": 1},
        ...
      ]
    },
    ...
  ]
}

${context.hasClauses ? 'También se proporcionan clausulados para validación; úsalos solo si una fila es ambigua, pero conserva el texto original de la cotización.' : ''}`;

    if (templateAddons && templateAddons.length > 0) {
      prompt += `\n\n--- Insurer-specific extraction hints ---\n\n${templateAddons.join('\n\n')}`;
    }

    return prompt;
  }

  /**
   * Build correction prompt for retry on malformed output
   */
  buildCorrectionPrompt(originalResponse: string, errorMessage: string): string {
    const trimmedResponse = originalResponse.trim();
    const formattedResponse =
      trimmedResponse.length > 40000 ? trimmedResponse.substring(0, 40000) : trimmedResponse;

    return `Tu respuesta anterior no cumplió el schema de tabla plana requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR:
${formattedResponse}

Por favor genera el JSON completo y válido con EXACTAMENTE estas filas:
1. Bienes Asegurados
2. Deducibles
3. Prima con IVA
4. Forma de Pago

Asegúrate de que:
1. El JSON tenga "insurers" como array de strings
2. El JSON tenga "rows" como array de objetos con "label" y "cells"
3. Cada celda tenga "insurer" y "value"
4. Si no encuentras una fila para una aseguradora, usa "No informado" como valor

Responde ÚNICAMENTE con el JSON corregido.`;
  }

  /**
   * Build v2 correction prompt for retry on malformed granular output
   */
  buildV2CorrectionPrompt(originalResponse: string, errorMessage: string): string {
    const trimmedResponse = originalResponse.trim();
    const formattedResponse =
      trimmedResponse.length > 40000 ? trimmedResponse.substring(0, 40000) : trimmedResponse;

    return `Tu respuesta anterior no cumplió el schema de tabla granular requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR:
${formattedResponse}

Por favor genera el JSON completo y válido con este schema:
{
  "insurers": ["Aseguradora A", ...],
  "quoteMetadata": [
    {
      "insurer": "Aseguradora A",
      "cliente": "...",

      "tipoSeguro": "...",
      "ubicacionRiesgo": "...",
      "anoConstruccion": "...",
      "pisos": "...",
      "aliado": "...",
      "actividadOcupacion": "...",
      "documento": "...",
      "vigencia": "..."
    }
  ],
  "rows": [
    {
      "label": "...",
      "section": "...",
      "cells": [
        {"insurer": "Aseguradora A", "value": "...", "rawText": "..."},
        ...
      ]
    },
    ...
  ]
}

Asegúrate de que:
1. El JSON tenga "insurers" como array de strings
2. El JSON tenga "quoteMetadata" como array de objetos con los metadatos correspondientes por aseguradora
3. El JSON tenga "rows" como array de objetos con "label", "section" y "cells"
4. Cada celda tenga "insurer" y "value"
5. Si no encuentras una fila para una aseguradora, usa "No informado" como valor

Responde ÚNICAMENTE con el JSON corregido.`;
  }

  /**
   * Build deep mode prompt for clause validation
   */
  buildDeepModePrompt(comparisonJson: string): string {
    return `Eres un analista experto en clausulados de seguros. Tu tarea es validar una comparación de cotizaciones contra los clausulados oficiales de las aseguradoras.

COMPARACIÓN ACTUAL:
${comparisonJson}

CLAUSULADOS PROPORCIONADOS:
[Los clausulados se adjuntan como documentos]

TAREA DE VALIDACIÓN:
1. Para cada deducible marcado como "Ver condiciones", busca el valor exacto en el clausulado
2. Verifica que las coberturas listadas como "Incluidas" realmente lo estén según el clausulado
3. Identifica exclusiones mencionadas en el clausulado pero no en la cotización
4. Detecta discrepancias entre lo que dice la cotización y el clausulado
5. Extrae sub-límites específicos del clausulado

Responde con un JSON que contenga:
- Las validaciones realizadas
- Los valores corregidos
- Las discrepancias encontradas
- El nivel de severidad de cada discrepancia`;
  }

  /**
   * Get the JSON Schema for structured output
   */
  getResponseSchema(): Record<string, unknown> {
    return UnifiedComparisonSchema;
  }
}

export const comparisonPromptBuilder = new ComparisonPromptBuilder();
export default comparisonPromptBuilder;
