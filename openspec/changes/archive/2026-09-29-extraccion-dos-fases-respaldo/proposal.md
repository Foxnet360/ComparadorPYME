# Proposal: Extracción Estructurada Multimodal en Dos Fases con Respaldo Automático

## Intent
Implementar la Fase 3 del Plan Integral de Modernización del comparador:
1. **Pipeline de Extracción en Dos Fases (Stage-Gated Extraction)**: Desacoplar la ingesta de documentos de seguros en dos etapas especializadas:
   - **Fase 1 (Global):** Extracción de metadatos del tomador, número de cotización, desglose financiero de prima y mapeo de secciones/páginas donde residen las tablas de cobertura.
   - **Fase 2 (Focalizada):** Extracción profunda de coberturas, deducibles, sublímites y citas textuales (`rawTextSnippet`, `pageNumber`), concentrando la atención del LLM únicamente en los bloques relevantes.
2. **Respaldo y Fallback Automático (Cero Regresiones):**
   - Envoltorio de orquestación con fallback automático al pipeline V2 de una sola pasada ante cualquier anomalía de schema, timeout o ausencia de coberturas.
3. **Control mediante Feature Flag (`enableTwoStageExtraction`):**
   - Activación granular por variable de entorno `ENABLE_TWO_STAGE_EXTRACTION`.

## Scope
1. **Extractor de Estructura Global (`server/src/services/twoStageExtraction/globalStructureExtractor.ts`):**
   - Prompt focalizado y schema Zod para metadatos, prima y secciones.
2. **Extractor Focalizado de Coberturas (`server/src/services/twoStageExtraction/focalizedCoverageExtractor.ts`):**
   - Extracción de amparos con anclaje posicional y citas textuales.
3. **Orquestador con Fallback (`server/src/services/twoStageExtraction/twoStageExtractionOrchestrator.ts`):**
   - Ensamblaje transparente a contrato `QuoteExtractionV2`.
4. **Integración en `quoteProcessingService.ts`:**
   - Enrutamiento condicionado a `featureFlags.isEnabled('enableTwoStageExtraction')`.

## Rollback Plan
- Desactivar la variable de entorno `ENABLE_TWO_STAGE_EXTRACTION=false`.
- El sistema procesa todas las cotizaciones a través del pipeline V2 probado en producción.

## Impact
- Incremento en la exhaustividad de extracción de deducibles y coberturas en cotizaciones densas (>10 páginas).
- Cero tiempo de inactividad o fallos en producción gracias al fallback automático.
