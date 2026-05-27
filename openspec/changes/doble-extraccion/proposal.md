## Why

El sistema comparador de seguros actualmente cuenta con una doble extracción simulada mediante expresiones regulares para las coberturas críticas (Incendio y Responsabilidad Civil), lo que expone a los corredores a alucinaciones de IA no detectadas y genera un alto índice de falsos positivos en las alertas de discrepancia. Es fundamental habilitar una verificación cruzada real con modelos de Gemini y optimizar la visualización y robustez del procesamiento de documentos para garantizar el más alto estándar de precisión técnica y experiencia de usuario.

## What Changes

- **Habilitación de Doble Extracción Real:** Reemplazar el simulador regex de coberturas críticas por una llamada real secundaria a la API de Gemini (con prompt alternativo) para contrastar de forma independiente los valores y deducibles de Incendio y RC.
- **Extracción Estructurada por Schema en Clausulados:** Refactorizar el extractor de cláusulas para utilizar la enforzación sintáctica nativa de Gemini (`responseSchema`), desechando el parseo por expresiones regulares crudas sobre texto libre.
- **Clasificación Robusta de Formatos de Cotización:** Modificar el procesador para inspeccionar palabras clave en los primeros caracteres de texto nativo del PDF para inferir la aseguradora y familia de formato, en lugar de depender únicamente de la inspección del nombre físico del archivo.
- **Priorización de Deducibles Normalizados en Matriz:** Invertir la precedencia de formateo de deducibles en el frontend para renderizar la versión estructurada y limpia primero, manteniendo el texto crudo solo como fallback secundario.
- **Seguridad en Tooltips de Deducibles:** Ajustar el posicionamiento y estilo de los tooltips de deducibles para prevenir recortes y desbordamientos dentro de los contenedores de scroll horizontal en la matriz de comparación.

## Capabilities

### New Capabilities
- `schema-enforced-clause-extraction`: Extracción estructurada de clausulados generales y particulares utilizando schemas rígidos nativos en la API de Gemini.
- `dual-extraction-verification`: Doble extracción independiente de coberturas críticas (Incendio y RC) con contraste automático para la detección de alucinaciones.
- `robust-format-detection`: Identificación inmune a nombres de archivo para inferir la aseguradora y familia de formato mediante escaneo de texto nativo preliminar.
- `normalized-deductible-ui`: Visualización limpia de deducibles estructurados compuestos con tooltips estables en contenedores responsivos con scroll lateral.

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->

## Impact

- **Backend / API:** Afecta a `structuredClauseExtractor.ts`, `dualExtractionService.ts` y `quoteProcessingService.ts` en el servidor. Incremento controlado en el volumen de llamadas de Gemini API (aprox. 5-10% por cotización).
- **Frontend / UI:** Afecta a `VariableComparisonMatrix.tsx` y `DeductibleBadge.tsx`. Mayor claridad visual en las celdas de deducibles y visualización de tooltips robusta.
- **Base de Datos / Cache:** Mayor volumen de mappings guardados en `coverage_mappings` gracias a la mayor precisión en el pipeline y la corrección de errores por parte del usuario.
