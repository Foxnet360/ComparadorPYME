## Why

El comparador de cotizaciones de seguros PYME sufre de problemas críticos que impiden generar análisis confiables: el RAG no encuentra clausulados existentes (0 chunks recuperados), el chat responde "no tengo información" cuando sí hay datos disponibles, los deducibles se parsean incorrectamente (solo 40% de precisión con regex), y las 14 categorías canónicas forzadas pierden la naturaleza real de las coberturas (ej: "AMPARO BASICO" mapeado solo a "Incendio" cuando es "Todo Riesgo" compuesto). Estos problemas causan que el 70% de los análisis requieran corrección manual, haciendo que la herramienta no aporte el valor esperado.

## What Changes

- **Reemplazar el sistema RAG actual** con una arquitectura de "Triple Capa" (estructurada + semántica + verificación) que extraiga clausulados a JSON estructurado en lugar de chunks de texto plano
- **Implementar una Ontología Fluida de Coberturas** que reemplace las 14 categorías rígidas con grupos semánticos dinámicos y mapeo probabilístico
- **Crear un Motor de Comparación Variable a Variable** que compare valores asegurados, deducibles compuestos, sublímites y exclusiones directamente sin forzar categorías
- **Rediseñar el Chat con Triple Fuente de Verdad** que priorice datos de cotización extraídos del PDF sobre búsquedas RAG fallidas
- **Implementar Parser Semántico de Deducibles** que entienda estructuras compuestas ("10% con mínimo de 5 SMMLV y tope de 50 SMMLV") y benchmarks de mercado por tipo de riesgo
- **Agregar Sistema de Aprendizaje Continuo** que mejore el tesauro y mapeos basado en correcciones del usuario
- **BREAKING**: Eliminar el mapeo forzado a 14 categorías canónicas y reemplazar coverageNormalizer con sistema de grupos semánticos
- **BREAKING**: Cambiar la respuesta del chat de dependencia total de RAG a sistema de triple fuente con fallback garantizado

## Capabilities

### New Capabilities
- `structured-clause-extraction`: Extracción de clausulados a JSON estructurado (coberturas, deducibles, exclusiones, condiciones) usando LLM en una sola pasada
- `semantic-coverage-ontology`: Sistema de grupos semánticos dinámicos con mapeo probabilístico y detección de coberturas compuestas
- `variable-comparison-engine`: Comparación directa de variables (valor asegurado, deducible estructurado, sublímite, exclusiones) sin clasificación forzada
- `deductible-semantic-parser`: Parser de deducibles compuestos con normalización a estructuras y benchmarks de mercado por tipo de riesgo
- `triple-source-chat`: Chat con triple fuente de verdad (cotización estructurada + clausulados + conocimiento general) con fallback garantizado
- `learning-engine`: Sistema de corrección/aprendizaje que actualiza tesauro, embeddings y ontología basado en feedback del usuario
- `query-expansion`: Expansión automática de queries RAG usando tesauro para mejorar recuperación
- `hybrid-search-v2`: Búsqueda híbrida mejorada con parent-child retrieval y re-ranking

### Modified Capabilities
- `rag-retrieval`: Cambiar de chunks de texto plano a búsqueda en JSON estructurado con query expansion
- `chat-with-rag`: Modificar prioridad de fuentes y agregar fallback a datos de cotización
- `semantic-coverage-matching`: Reemplazar matching a 14 categorías con mapeo probabilístico a grupos semánticos
- `deductible-risk-analysis`: Extender para soportar deducibles compuestos y benchmarks
- `coverage-cross-reference`: Adaptar para comparar variables estructuradas en lugar de categorías canónicas

## Impact

**Código afectado:**
- Servicios principales: `ragRetrievalService.ts`, `chatService.ts`, `semanticMatcher.ts`, `coverageNormalizer.ts`, `deductibleAnalyzer.ts`, `crossReferenceEngine.ts`
- Nuevos servicios: `structuredClauseExtractor.ts`, `coverageOntology.ts`, `variableComparator.ts`, `deductibleParser.ts`, `learningEngine.ts`
- Controladores: `analysisController.ts`, `chat.ts`
- Tipos: Actualización de `types.ts` con nuevas interfaces

**Base de datos:**
- Nueva tabla: `structured_clauses` (JSONB)
- Nueva tabla: `coverage_mappings` (aprendizaje)
- Índices GIN para búsqueda en JSONB
- Migraciones RPC para búsqueda híbrida

**APIs:**
- Nuevo endpoint: `/api/clauses/structured` (extracción estructurada)
- Nuevo endpoint: `/api/quotes/compare-variables` (comparación por variables)
- Modificación: `/api/chat` (triple fuente de verdad)

**Dependencias:**
- Gemini API (mayor uso inicial para extracción estructurada)
- Supabase (nuevas tablas y funciones)
- Redis (cache de embeddings y mapeos)

**Rendimiento:**
- Tiempo de análisis objetivo: < 120 segundos (actual: 270s)
- Reducción de llamadas a LLM mediante cache y procesamiento estructurado
