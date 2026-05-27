# Proposal: unified-multimodal-comparison-engine

## Why

El sistema actual extrae, normaliza y compara cotizaciones mediante múltiples servicios independientes (extracción individual por PDF, normalización a 14 categorías canónicas, ontología semántica, RAG) que acumulan errores y pérdida de contexto. Múltiples intentos archivados (más de 10 cambios) han fallado en resolver el problema fundamental. La extracción de deducibles es errática (solo 40% precisión), la normalización pierde equivalencias semánticas ("Amparo Básico" ≠ "Sección Primera" aunque cubran lo mismo), y el chat responde "no tengo información" a pesar de tener datos. Sin embargo, un prompt simple con LLM multimodal logró generar una comparativa Excel completa y precisa en una sola pasada con 4 cotizaciones, demostrando que el problema es de razonamiento comparativo, no de extracción individual.

## What Changes

1. **Motor de Comparación Unificada Multimodal**:
   - Nuevo servicio `unifiedComparisonEngine.ts` que procesa N PDFs de cotización en una sola llamada a Gemini 3.5 Flash
   - Prompt diseñado según mejores prácticas oficiales: sin temperature/top_p/top_k, usando `thinking_level: "medium"` (default)
   - Output: JSON comparativo estructurado que replica exactamente las 3 hojas del Excel técnico (Portada, Coberturas y Deducibles, Primas y Costos)
   - Incluye detección automática de coberturas equivalentes, deducibles estructurados, y coberturas exclusivas

2. **Modo Profundo con Clausulados**:
   - Cuando existen PDFs de clausulados, se incluyen como contexto adicional en el prompt
   - El motor valida deducibles ambiguos ("Ver condiciones") contra cláusulas
   - Flag `deep_mode: boolean` para activar/desactivar análisis con clausulados

3. **Arquitectura de Coexistencia Segura**:
   - Feature flag `USE_UNIFIED_ENGINE` (default: `false`) para control gradual
   - Adapter pattern: el nuevo motor se adapta a la interfaz `MatrixRow[]` existente
   - Fallback automático al motor legacy si el nuevo motor falla
   - No se modifica `matrixTransformer.ts`, `excelGenerator.ts`, ni `UnifiedCoverageMatrix.tsx`

4. **Endpoint API**:
   - `POST /api/comparison/unified` - Procesar cotizaciones con motor unificado
   - `POST /api/comparison/:id/deep-mode` - Enriquecer con clausulados posteriormente

## Capabilities

### New Capabilities
- `unified-comparison-extraction`: Motor multimodal que procesa N cotizaciones simultáneamente, generando JSON comparativo estructurado compatible con MatrixRow[]
- `deep-clause-validation`: Validación de deducibles y coberturas ambiguas contra clausulados cuando están disponibles
- `comparison-engine-adapter`: Adaptador que permite coexistencia del motor nuevo con el sistema legacy mediante feature flags y fallback automático

### Modified Capabilities
- `quote-analysis-v2`: Depreca extracción individual por PDF, reemplaza por comparación unificada cuando el feature flag está activo

## Impact

- **Backend Services**:
  - Nuevo: `server/src/services/unifiedComparisonEngine.ts`
  - Nuevo: `server/src/services/comparisonPromptBuilder.ts`
  - Nuevo: `server/src/services/comparisonResultValidator.ts`
  - Nuevo: `server/src/services/comparisonEngineAdapter.ts`
  - Nuevo tipos: `server/src/types/unifiedComparison.ts`

- **API Routes**:
  - Nuevo: `POST /api/comparison/unified`
  - Nuevo: `POST /api/comparison/:id/deep-mode`

- **Feature Flags**:
  - Variable de entorno: `USE_UNIFIED_ENGINE` (default: `false`)

- **Dependencias**:
  - Utiliza `@google/genai` SDK (ya instalado)
  - Modelo: `gemini-3.5-flash` (ya configurado)

- **Backward Compatibility**:
  - 100% compatible con la interfaz `MatrixRow[]` existente
  - UI React y Excel exportador no requieren cambios
  - Fallback automático al motor legacy si el nuevo falla
  - Gradual rollout: 10% → 50% → 100% de usuarios

- **Performance**:
  - Tiempo esperado: 30-60 segundos para 4-8 cotizaciones (vs 270s actual)
  - Una sola llamada a Gemini vs 4 llamadas individuales + normalización + RAG
