## Why

Los logs de producción revelan dos problemas críticos que degradan la calidad del análisis de cotizaciones:

1. **Coberturas extraídas del PDF se pierden antes de llegar al navegador**: Gemini extrae 17, 3 y 21 coberturas de los PDFs de HDI, Allianz y SBS respectivamente, pero el sistema solo presenta 9, 3 y 8. El normalizador filtra coberturas no mapeadas que no tienen valor asegurado ni prima, descartando coberturas textuales válidas. Además, la ontología semántica no agrupa correctamente ciertas coberturas, dejándolas como "uncategorized" con confianza cero.

2. **El sistema RAG de clausulados está completamente inoperativo**: La auditoría de riesgos muestra siempre "No hay clausulados indexados disponibles". La causa es un desfase entre dos sistemas de chunks paralelos: el indexador escribe en `chunks` (embedding 3072, sin insurer_name), pero el servicio de auditoría busca en `clause_chunks` (embedding 768, con insurer_name) que nunca se llena. Además, la función RPC `search_structured_clauses` definida en la migración 013 no existe en la base de datos.

## What Changes

### Fase 1: Hotfix rápido — Preservar coberturas y reparar auditoría

- **Modificar `coverageNormalizer.ts`**: Relajar el filtro que elimina coberturas uncategorized sin `insuredAmount` ni `premium`. Las coberturas textuales válidas deben preservarse siempre.
- **Modificar `auditEnrichmentService.ts`**: Cambiar `checkClausesAvailability` para consultar primero la tabla `chunks` (que tiene datos reales) en vez de `clause_chunks` (vacía/inexistente).
- **Verificar rendering frontend**: Asegurar que `uncategorizedCoverages` se rendericen en la UI comparativa.

### Fase 2: Estructural — Unificar sistema de chunks y corregir schema

- **Aplicar migración 013 en Supabase**: Crear `structured_clauses`, `coverage_mappings`, `deductible_benchmarks`, y la función `search_structured_clauses`.
- **Crear/migrar tabla `clause_chunks`**: Si no existe, crearla con la estructura correcta. Evaluar si se migra desde `chunks` o si se redirigen las queries.
- **Modificar `gemini.ts`**: Hacer el campo `deductible` nullable en `QuoteExtractionSchemaV2` para evitar rechazo de coberturas válidas sin deducible explícito.

### Fase 3: Polish — Observabilidad y robustez

- **Agregar logging de pérdida**: En `coverageNormalizer.ts`, loguear cada cobertura descartada con `rawName` y razón.
- **Reducir noise de errores**: En `structuredClauseExtractor.ts`, loguear el fallback a legacy RAG como INFO en vez de ERROR.
- **Revisar ontology mappings**: Verificar por qué coberturas como "Gastos de Defensa", "Gastos Médicos", "Daño Interno" no mapean a grupos semánticos.

## Capabilities

### New Capabilities

- `coverage-preservation`: Garantizar que todas las coberturas extraídas de un PDF sean visibles en el navegador, ya sea mapeadas a categorías canónicas o como coberturas sin clasificar.

### Modified Capabilities

- `quote-extraction`: Cambio en el schema de extracción (deductible nullable) y en el normalizador (preservar uncategorized). Requiere delta spec.
- `rag-clause-retrieval`: Corrección del sistema de búsqueda de clausulados para usar la tabla correcta y disponibilizar la función RPC faltante. Requiere delta spec.

## Impact

- **Código**: `server/src/services/coverageNormalizer.ts`, `server/src/services/auditEnrichmentService.ts`, `server/src/services/gemini.ts`, `server/src/services/structuredClauseExtractor.ts`, componentes frontend de comparación.
- **Base de datos**: Aplicación de migración 013, posible creación/migración de `clause_chunks`.
- **APIs**: Ningún cambio en contrato de API externo.
- **Dependencias**: Supabase (migraciones), sistema de embeddings (dimensiones 3072 vs 768).
- **Riesgo**: Cambiar el filtro de uncategorized puede exponer coberturas "basura" del PDF. Mitigación: marcar con `needsReview: true` y confianza baja.
