# Tasks: Robustez de Extracción Multicotización y Reparación de JSON

## Phase 1: Sanitización y Detección de Markdown Fences
- [x] 1.1 Implementar función helper `stripMarkdownFences` y aplicarla en `flatTableParser.ts` antes de `detectFormat` y `parseJsonV2`.
- [x] 1.2 Agregar tests unitarios en `flatTableParser.test.ts` verificando que JSONs envueltos en ` ```json ` se detecten como `json` y se parseen sin errores.

## Phase 2: Reparador de JSON V2 y Corrección de Prompts
- [x] 2.1 Actualizar `jsonRepair.ts` para que reconozca y repare truncamientos en estructuras granulares `{ insurers, rows, quoteMetadata }`.
- [x] 2.2 Eliminar el truncamiento `substring(0, 1000)` en `comparisonPromptBuilder.ts` (`buildV2CorrectionPrompt` y `buildCorrectionPrompt`).
- [x] 2.3 Agregar tests unitarios en `comparisonPromptBuilder.test.ts` y `jsonRepair.test.ts`.

## Phase 3: Preservación de Contexto Multimodal en Reintentos
- [x] 3.1 Modificar `unifiedComparisonEngine.ts` para incluir `uploadedFiles` en los reintentos de `generateContent` si el parseo inicial falla.
- [x] 3.2 Probar con suite de pruebas y verificar ausencia de regresiones en los tests existentes.
