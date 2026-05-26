## Why

El sistema de Comparador CSA presenta degradaciones y fallas críticas que impiden su uso confiable por parte de los corredores: la extracción de cotizaciones de aseguradoras con múltiples formatos omite datos importantes, el parser de deducibles falla constantemente ante términos complejos o genera falsos positivos, la base de datos RAG no indexa clausulados debido a desajustes de dimensiones de vectores (768 vs 3072) y el chat del asistente devuelve "no tengo información" al caerse por consultas a tablas (`clause_documents`) y vistas (`document_insurer_view`) rotas. Esta propuesta corrige de raíz estas ineficiencias integrando de forma homogénea Gemini 3.5 Flash (multimodal) y Gemini Embeddings V2 alineados a la base de datos.

## What Changes

- **Bypass de extracción en cotizaciones**: Eliminar el parseo de texto plano intermedio con `pdfjs-dist` para cotizaciones y transicionar a una ingesta multimodal directa enviando el PDF nativo a la Gemini File API.
- **Alineación de embeddings a 3072 dimensiones**: Actualizar el backend (`embeddingService.ts`) para usar `text-embedding-004` con dimensión de salida 3072, eliminando el choque de dimensiones con Supabase.
- **Reparación de esquemas de Supabase**: Corregir y recompilar la vista `document_insurer_view` y actualizar las referencias en el backend para remover la tabla inexistente `clause_documents`.
- **Segmentación semántica ampliada**: Incrementar el tamaño de chunk a 2500-3000 caracteres en `semanticChunker.ts` para conservar el contexto completo de cláusulas legales y agregar OCR fallback vía Gemini 3.5 Flash para clausulados escaneados.
- **Deducibles con Structured Outputs**: Refactorizar el parser de deducibles complejos para usar Gemini Structured Outputs nativos (`responseSchema`) en lugar de parsing de texto libre con regex inestables.
- **Robustecimiento del Chat RAG**: Corregir la verificación de clausulados en el chat y reducir el umbral de similitud en RAG (`MIN_SIMILARITY_THRESHOLD = 0.62`) implementando un método blended de re-ranking.

## Capabilities

### New Capabilities
*(No se introducen capacidades completamente nuevas desde cero, se corrigen y estabilizan los requerimientos de las capacidades existentes).*

### Modified Capabilities
- `multimodal-pdf-extraction`: Ingesta nativa de PDFs en la Gemini File API y uso de visión multimodal para cotizaciones sin intermediación de OCR plano.
- `semantic-chunking`: Aumento de tamaño de chunks (2500-3000 chars) y soporte de OCR fallback multimodal para clausulados escaneados.
- `vector-storage-v2`: Transición del backend al modelo `text-embedding-004` con salida estricta de 3072 dimensiones.
- `deductible-semantic-parser`: Uso de Gemini Structured Outputs con responseSchema estricto en la extracción de componentes y normalización de deducibles.
- `triple-source-chat`: Corrección de consultas a esquemas en Supabase, remoción de tablas obsoletas (`clause_documents`) y blended RAG con umbral optimizado a 0.62.

## Impact

- **Backend**: `gemini.ts`, `embeddingService.ts`, `quoteProcessingService.ts`, `semanticChunker.ts`, `deductibleParser.ts`, `chatService.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts` y `ragRetrievalService.ts`.
- **Database**: Vista `document_insurer_view`, tablas `clause_coverages` y funciones RPC de búsqueda híbrida.
- **Dependencias**: Se consolida el uso del nuevo SDK `@google/genai` instalado para llamadas con responseSchema estructurado.
