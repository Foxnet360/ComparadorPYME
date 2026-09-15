# Proposal: Robustez de Extracción Multicotización (6+ Cotizaciones) y Reparación de JSON

## Intent
Resolver la pérdida de datos (primas en 0, ausencia de deducibles y reducción a 4 filas genéricas) al comparar 6 o más cotizaciones complejas (como copropiedades o multirriesgo).

Actualmente, cuando se procesan 6 cotizaciones en simultáneo:
1. Gemini devuelve un JSON extenso que a menudo incluye bloques markdown (` ```json ... ``` `) o ligeras imperfecciones de sintaxis.
2. `flatTableParser.ts` detecta el formato como `'kv'` o falla en `parseJsonV2` debido a los bloques markdown.
3. El motor activa el prompt de corrección (`buildV2CorrectionPrompt`), el cual **trunca la respuesta a solo 1.000 caracteres** (`originalResponse.substring(0, 1000)`) y llama a Gemini **sin los archivos PDF adjuntos**, forzando al modelo a alucinar una tabla incompleta de 4 filas con primas en 0.

## Scope
1. **Sanitización de Markdown Fences en el Parser:**
   - Preprocesar la salida de Gemini en `flatTableParser.ts` y `jsonRepair.ts` para extraer limpiamente el cuerpo JSON de cualquier bloque de código markdown (` ```json ... ``` `) antes de llamar a `detectFormat` y `parseJsonWithRepair`.
2. **Eliminación del Truncamiento a 1.000 Caracteres en Prompts de Corrección:**
   - Modificar `buildV2CorrectionPrompt` y `buildCorrectionPrompt` en `comparisonPromptBuilder.ts` para no amputar la respuesta previa.
   - Enviar el JSON completo o enfocar la corrección en el bloque con error de sintaxis específico.
3. **Soporte de Reparación para Schema Granular V2 en `jsonRepair.ts`:**
   - Añadir soporte en `jsonRepair.ts` para rescatar estructuras parciales `{ insurers, rows, quoteMetadata }` cuando un JSON esté truncado o tenga comas colgantes, evitando recurrir a reintentos innecesarios con el LLM.
4. **Preservación de Contexto Multimodal en Reintentos de Gemini:**
   - En `unifiedComparisonEngine.ts`, si se requiere una llamada de corrección al LLM, mantener los archivos PDF adjuntos para que Gemini conserve la fuente de verdad y no invente datos.

## Impact
- Soporte robusto y sin pérdida de datos para comparaciones masivas de 6 a 10 cotizaciones.
- Preservación exacta de primas, deducibles y coberturas en ramos densos (copropiedades, PYME, cumplimiento).
- Reducción de latencia y costos al reparar JSON localmente sin invocar reintentos redundantes al API de Gemini.
