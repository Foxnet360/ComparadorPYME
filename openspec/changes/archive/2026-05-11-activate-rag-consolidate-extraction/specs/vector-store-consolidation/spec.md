## ADDED Requirements

### Requirement: Funciones SQL unificadas para RAG
El sistema DEBE crear funciones SQL que usen tabla `chunks` con filtro por `document_type` en vez de `clause_chunks`.

#### Scenario: Búsqueda híbrida unificada
- **WHEN** se llama `match_chunks_unified(query_embedding, query_text, ...)`
- **THEN** la función DEBE buscar en tabla `chunks`
- **AND** filtrar por `document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')`
- **AND** aplicar búsqueda híbrida vectorial + full-text
- **AND** retornar resultados con metadata completa

#### Scenario: Búsqueda vectorial unificada
- **WHEN** se llama `match_chunks_vector_unified(query_embedding, ...)`
- **THEN** la función DEBE buscar solo por similitud vectorial en `chunks`
- **AND** filtrar por document_type de clausulados
- **AND** retornar resultados ordenados por similitud

#### Scenario: Búsqueda por cobertura unificada
- **WHEN** se llama `get_chunks_by_coverage(coverage_name, ...)`
- **THEN** la función DEBE buscar en `chunks` por `coverage_tags`
- **AND** filtrar por document_type de clausulados
- **AND** retornar chunks relevantes

### Requirement: Servicio RAG actualizado
El sistema DEBE actualizar `ragRetrievalService` para usar las nuevas funciones SQL unificadas.

#### Scenario: Servicio usa chunks unificados
- **WHEN** `ragRetrievalService.search()` es llamado
- **THEN** el servicio DEBE usar `match_chunks_unified`
- **AND** pasar `document_type` como filtro
- **AND** retornar estructura de datos compatible

### Requirement: Deprecar clause_chunks
El sistema DEBE marcar tabla `clause_chunks` como deprecated sin eliminarla inmediatamente.

#### Scenario: Tabla clause_chunks marcada como deprecated
- **WHEN** se consulta la documentación del schema
- **THEN** `clause_chunks` DEBE estar marcada como deprecated
- **AND** los nuevos servicios NO DEBEN usarla
- **AND** los datos existentes DEBEN permanecer intactos
