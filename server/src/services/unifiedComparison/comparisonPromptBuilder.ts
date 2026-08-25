/**
 * Comparison Prompt Builder
 * Builds the multimodal prompt for Gemini 3.5 Flash to compare insurance quotes
 * Based on the successful reference prompt from prompt_agente_comparativa_seguros.md
 */

import { UnifiedComparisonSchema } from './comparisonSchema';

export interface PromptContext {
  insurerCount: number;
  hasClauses?: boolean;
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

    return `Eres un analista de seguros PYME en Colombia. He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y EXACTAMENTE estas filas:
${rowList}

Reglas:
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
  buildV2ComparisonPrompt(context: PromptContext, templateAddons?: string[]): string {
    const sectionList = GRANULAR_SECTIONS.map((section, sIdx) => {
      const rows = section.rows.map((row, rIdx) => `    ${rIdx + 1}. ${row}`).join('\n');
      return `  ${sIdx + 1}. ${section.section}:\n${rows}`;
    }).join('\n\n');

    let prompt = `Eres un analista de seguros PYME en Colombia. He subido ${context.insurerCount} cotizaciones del mismo riesgo.

Genera una tabla comparativa con UNA columna por aseguradora y filas agrupadas por sección. A continuación te sugiero filas granulares, pero PUEDES agregar o renombrar filas según lo que aparezca textualmente en cada cotización. No omitas una fila si la información existe en al menos una cotización.

${sectionList}

Reglas de Negocio para Secciones:
1. BIENES ASEGURADOS: Extrae las sumas aseguradas o descripciones de Mercancías, Muebles y enseres, Maquinaria y equipo, Equipo eléctrico y electrónico, y Asistencia.
2. COBERTURAS: Extrae límites, amparos y condiciones de cobertura para Amparo básico todo riesgo, Terremoto, Responsabilidad Civil Extracontractual (RCE), Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Gastos médicos, Asistencia, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, HMACC-AMIT, y RC en proceso civil.
3. DEDUCIBLES: Extrae los deducibles específicos para Todo Riesgo Incendio, Anegación / Cobertura Extendida, Terremoto, HMACC-AMIT, RCE, Lucro Cesante, Rotura de Maquinaria, Equipos eléctricos y electrónicos, Vidrios, Manejo global / Infidelidad, Transporte de mercancías, Daños por agua / Anegación, y Sustracción con Violencia. Debes incluir una fila por cada deducible que aparezca textualmente en las cotizaciones; no omitas deducibles.
4. SUSTRACCIÓN: Extrae límites y condiciones para Sustracción con Violencia.
5. FINANCIAL: Extrae Prima con IVA incluido, Gastos de expedición, IVA, Total prima, y Forma de pago.

Reglas Generales:
- REGLA CRÍTICA DE COMPLETITUD: DEBES EXTRAER EL 100% DE LAS COBERTURAS, BIENES, DEDUCIBLES Y CONDICIONES PRESENTES EN LAS COTIZACIONES. NO OMITAS NINGUNA FILA POR RESUMEN O LÍMITE DE ESPACIO. SI EXISTEN 30 O 40 AMPAROS, GENERA LAS 30 O 40 FILAS EN EL JSON.
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
      "label": "Mercancías",
      "section": "BIENES ASEGURADOS",
      "cells": [
        {"insurer": "Aseguradora A", "value": "...", "rawText": "..."},
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
    return `Tu respuesta anterior no cumplió el schema de tabla plana requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

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
    return `Tu respuesta anterior no cumplió el schema de tabla granular requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

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
