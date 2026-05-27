/**
 * Comparison Prompt Builder
 * Builds the multimodal prompt for Gemini 3.5 Flash to compare insurance quotes
 * Based on the successful reference prompt from prompt_agente_comparativa_seguros.md
 */

import { GoogleGenAI, Type } from "@google/genai";
import { UnifiedComparisonSchema } from './comparisonSchema';

const SchemaType = Type;

export interface PromptContext {
  insurerCount: number;
  hasClauses?: boolean;
}

export class ComparisonPromptBuilder {
  
  /**
   * Build the main comparison prompt
   */
  buildComparisonPrompt(context: PromptContext): string {
    return `Eres un analista experto en seguros comerciales con amplia experiencia en la comparación de cotizaciones de múltiples aseguradoras en Colombia.

CONTEXTO:
- Estás analizando ${context.insurerCount} cotizaciones de seguros PYME para el mismo tomador/riesgo
- Cada cotización corresponde al mismo riesgo pero con términos y condiciones diferentes según la aseguradora
- Las cotizaciones pueden usar diferentes nombres para coberturas equivalentes

TAREA:
Analiza TODAS las cotizaciones proporcionadas y genera una comparación estructurada en formato JSON.

INSTRUCCIONES DE EXTRACCIÓN:

1. INFORMACIÓN GENERAL (de cada cotización):
   - Nombre de la aseguradora
   - Nombre del tomador/asegurado
   - Actividad económica / CIIU
   - Dirección del riesgo
   - Ciudad
   - Fecha de cotización
   - Vigencia de la cotización
   - Producto/Ramo
   - Valor total de los bienes asegurables

2. BIENES ASEGURADOS:
   - Edificio / Mejoras locativas
   - Contenidos / Muebles y enseres
   - Mercancías / Existencias
   - Equipo eléctrico y electrónico fijo
   - Equipo móvil y portátil
   - Maquinaria y equipo
   - Dinero en efectivo / Valores

3. COBERTURAS PRINCIPALES (comparar TODAS las que apliquen):
   - Amparo Básico / Todo Riesgo Daño Material
   - Terremoto / Temblor / Erupción volcánica
   - AMIT / HMACC (Huelga, Motín, Asonada, Conmoción Civil)
   - Daño Interno / Equipo Eléctrico y Electrónico
   - Equipos Móviles y Portátiles
   - Hurto Calificado / Sustracción con Violencia
   - Hurto Simple
   - Lucro Cesante / Pérdidas Consecuenciales
   - Infidelidad de Empleados
   - Responsabilidad Civil Extracontractual (RCE)
   - Accidentes Personales
   - Rotura de Maquinaria
   - Transporte de Mercancías
   - Rotura Accidental de Vidrios
   - Asistencias

4. DEDUCIBLES:
   - Extraer el deducible para CADA cobertura y CADA aseguradora
   - Estructura: porcentaje, mínimo, moneda
   - Si no está claro, usar "Ver condiciones"
   - Si no aplica, indicar "No aplica"

5. PRIMAS Y COSTOS:
   - Prima Neta
   - Gastos de expedición
   - IVA (19% en Colombia)
   - Prima Total / Total a Pagar

REGLAS CRÍTICAS:
1. Identifica coberturas EQUIVALENTES aunque tengan nombres diferentes
2. Marca como "N.C." (No Contratado) las coberturas que una aseguradora no ofrezca
3. Si una cobertura está "incluida" dentro de otra, indícalo claramente
4. NO inventes datos. Si no encuentras algo, usa null o "No informado"
5. Extrae los deducibles EXACTAMENTE como aparecen en el documento
6. Calcula el % sobre valor asegurado cuando sea posible
7. Identifica coberturas EXCLUSIVAS (solo una aseguradora las ofrece)
8. Genera alertas para diferencias significativas entre aseguradoras

${context.hasClauses ? '\nNOTA: También se proporcionan clausulados para validación. Usa la información de los clausulados para confirmar deducibles y coberturas ambiguas.' : ''}

OUTPUT: Responde ÚNICAMENTE con el JSON estructurado siguiendo el schema proporcionado. No incluyas explicaciones ni texto adicional.`;
  }

  /**
   * Build correction prompt for retry on malformed output
   */
  buildCorrectionPrompt(originalResponse: string, errorMessage: string): string {
    return `Tu respuesta anterior tenía un error de formato. Por favor corrige el JSON.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido siguiendo exactamente el schema requerido.
Asegúrate de que:
1. Todos los campos requeridos estén presentes
2. Los arrays tengan la estructura correcta
3. Los valores null estén explícitamente indicados
4. No haya campos adicionales fuera del schema

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
  getResponseSchema(): any {
    return UnifiedComparisonSchema;
  }
}

export const comparisonPromptBuilder = new ComparisonPromptBuilder();
export default comparisonPromptBuilder;
