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
