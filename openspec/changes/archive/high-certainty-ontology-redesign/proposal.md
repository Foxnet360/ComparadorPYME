## Why

El sistema de comparación de seguros actual cuenta con una tasa residual de alucinaciones en la extracción y normalización de coberturas complejas procedentes de cotizaciones desestructuradas. Adicionalmente, el proceso de validación profunda sufre de cuellos de botella de red por cargas repetidas de archivos masivos a la File API, y la indexación de clausulados es lenta debido a un procesamiento en lotes sub-optimizado de embeddings (lote de 10). 

Este cambio se introduce ahora para robustecer y unificar los modelos de Gemini, implementar un flujo de normalización de coberturas de certeza absoluta (consenso ciego de doble agente y anclaje determinista de páginas), y resolver los cuellos de botella de RAG.

## What Changes

1. **Unificación de Modelos a Gemini 3.5 Flash**: Configurar `gemini-3.5-flash` como el modelo estandarizado para toda la extracción de cotizaciones (visión multimodal), extracción estructurada de clausulados y parser semántico de deducibles. Mantener `gemini-2.5-flash-lite` exclusivamente en el chatbot conversacional SeguroBot para optimizar latencia y costos.
2. **Consenso Ciego de Doble Agente (Taxónomo vs. Crítico)**: Rediseñar el pipeline de normalización de coberturas. El Agente A (Taxónomo) propone una clasificación ontológica. El Agente B (Crítico) se ejecuta en un hilo de API aislado, sin historial, desafiando la propuesta de A. Si discrepan, la cobertura se marca con confianza del 50% y requiere intervención del usuario (Human-in-the-Loop).
3. **Anclaje Determinista de Páginas (Reverse String Anchoring)**: Gemini extraerá un fragmento de texto textual (`rawTextSnippet`) del PDF en lugar de adivinar el número de página. El backend buscará matemáticamente ese snippet en la estructura de texto de pdf.js para resolver de forma exacta y 100% verídica la página de origen en la matriz de comparación.
4. **Optimización de Embeddings en Batch**: Modificar la constante `BATCH_SIZE` de 10 a 100 en `embeddingService.ts` para acelerar la indexación vectorial de clausulados de minutos a escasos segundos, reduciendo los roundtrips HTTP con la API en un 90%.
5. **Auditoría Expuesta y Retroalimentación Directa**: Exponer en la interfaz (tooltips inline) la justificación del mapeo y la página real. Almacenar cada corrección humana de cobertura mediante el `learningEngine` con pesos vectoriales de 1.5 en el modelo `gemini-embedding-2` para retroalimentar el sistema.

## Capabilities

### New Capabilities
- `blind-consensus-classification`: Flujo de consenso asíncrono ciego entre un agente clasificador y un agente auditor para normalización de coberturas complejas con control de discrepancias en caliente.
- `reverse-string-anchoring`: Mapeo y localización posicional determinista de strings sobre documentos PDF utilizando fragmentos textuales contrastados contra la estructura por páginas de pdf.js.

### Modified Capabilities
- `gemini-model-configuration`: Estandarizar fallbacks y variables ambientales para usar `gemini-3.5-flash` en extracción y estructuración densa, y unificar `gemini-embedding-2` como el modelo de representación de vectores de 3072 dimensiones.
- `batch-embedding-normalization`: Reconfigurar la vectorización en batch de 10 a 100 contenidos concurrentes para optimizar la velocidad del RAG de clausulados.
- `learning-engine`: Ampliar el guardado de correcciones humanas para registrar el snippet físico, el número de página calculado e inyectar ejemplos históricos dinámicos (few-shots) en el clasificador de la Fase 4.

## Impact

- **Servicios Backend Afectados**: 
  - [structuredClauseExtractor.ts](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/server/src/services/structuredClauseExtractor.ts) (Alineación de modelo Gemini 3.5).
  - [embeddingService.ts](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/server/src/services/vector/embeddingService.ts) (Ajuste de `BATCH_SIZE` a 100).
  - [coverageOntology.ts](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/server/src/services/coverageOntology.ts) (Implementación del Consenso de Doble Agente).
  - [learningEngine.ts](file:///home/foxnet360/Documentos/dev/Corredores/comparador-csa/server/src/services/learningEngine.ts) (Esquema de Few-Shot dinámico y almacenamiento extendido).
- **APIs**:
  - `POST /api/analysis/extract-structured-clause` (Incluye ahora evidencia textual `rawTextSnippet`).
  - `POST /api/analysis/correction` (Esquema modificado para incluir snippet y justificación).
