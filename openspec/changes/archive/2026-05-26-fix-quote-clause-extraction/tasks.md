## 1. Reparación de Base de Datos y Supabase

- [x] 1.1 Recompilar la vista `document_insurer_view` con JOIN correcto a `insurers` en Supabase.
- [x] 1.2 Depurar funciones RPC (`match_chunks_unified`, `search_structured_clauses`) para remover dependencias de la tabla inexistente `clause_documents`.
- [x] 1.3 Corregir la consulta en `clauseCoverageValidator.ts` para resolver el error de columna inexistente `insurer_name` en la consulta Supabase de `clause_coverages`.

## 2. Ingesta Multimodal Nativa con Gemini 3.5 Flash

- [x] 2.1 Refactorizar `geminiService.extractFromPdfWithVision` para utilizar la Gemini File API nativa con borrado asegurado en bloque `finally`.
- [x] 2.2 Modificar `quoteProcessingService.ts` (`processQuoteMultimodal`) para enviar PDFs directamente a la API de archivos y prescindir de la lectura de texto plano.
- [x] 2.3 Configurar `QuoteExtractionSchemaV2` como esquema estricto en la generación de contenido multimodal.

## 3. Alineación y Configuración de Embeddings 3072

- [x] 3.1 Modificar `embeddingService.ts` para usar `text-embedding-004` y fijar `EMBEDDING_DIMENSIONS` a 3072.
- [x] 3.2 Asegurar que el método `generateEmbeddingsBatch` devuelva vectores alineados de 3072 dimensiones.
- [x] 3.3 Actualizar el script de verificación `verifySetup.js` para reflejar la conectividad a 3072 dimensiones.

## 4. Segmentación Semántica y OCR Fallback

- [x] 4.1 Ajustar `targetChunkSize` a 2500 - 3000 caracteres con 15% de overlap en `semanticChunker.ts` para preservar la cohesión de cláusulas legales.
- [x] 4.2 Implementar en `documentIndexingService.ts` un OCR fallback con Gemini 3.5 Flash para transcribir y procesar páginas escaneadas sin texto.

## 5. Deducibles Estructurados y Chat RAG Blended

- [x] 5.1 Refactorizar `deductibleParser.ts` para usar Gemini Structured Outputs con un esquema JSON tipado estricto en la extracción de componentes.
- [x] 5.2 Aplicar `.trim().toLowerCase()` a deducibles en `quoteValidator.ts` para evitar falsas advertencias de formatos no reconocidos.
- [x] 5.3 Ajustar `MIN_SIMILARITY_THRESHOLD` a 0.62 en `ragRetrievalService.ts` e implementar blended search unificado en el chat.
