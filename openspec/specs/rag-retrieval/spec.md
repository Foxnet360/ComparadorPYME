# RAG Retrieval

## Capability
Recuperación de chunks de cláusulas relevantes usando búsqueda híbrida (vectorial + full-text) con filtrado por aseguradora y cobertura, incluyendo fallback entre aseguradoras.

## User Story
**Como** sistema de análisis
**Quiero** recuperar cláusulas relevantes para una cobertura específica
**Para** cross-referenciar con cotizaciones

## Functional Requirements

### FR-1: Retrieve relevant clause chunks for coverage analysis
The system SHALL retrieve clause chunks relevant to a specific coverage from the vector store when analyzing a quote.

#### Scenario: Search for coverage exclusions
- **WHEN** analyzing a coverage like "Responsabilidad Civil"
- **THEN** the system SHALL retrieve chunks containing exclusions, limitations, and conditions related to that coverage
- **AND** the search uses hybrid vector + full-text search
- **AND** results are filtered by insurer_name and coverage_tags

#### Scenario: Search by multiple terms
- **WHEN** a search includes multiple terms like ["terremoto", "exclusión", "deducible"]
- **THEN** the system SHALL combine the terms into a single embedding query
- **AND** use the coverage_tags array for pre-filtering

### FR-2: Return chunks with citation metadata
The system SHALL return retrieved chunks with complete citation information for display in the analysis report.

#### Scenario: Include section reference
- **WHEN** chunks are returned from retrieval
- **THEN** each chunk SHALL include: document_name, insurer_name, section_type, coverage_tags, page_number

#### Scenario: Coverage-tagged retrieval
- **WHEN** retrieval is requested for coverage "Incendio"
- **THEN** the system SHALL use coverage_tags array for initial filtering
- **AND** then apply vector similarity ranking on the filtered subset

#### Scenario: Limit results
- **WHEN** a retrieval request specifies a limit
- **THEN** the system SHALL return no more than the specified number of chunks (default 5)

### FR-3: Cross-insurer fallback retrieval
The system SHALL fall back to generic clauses when no clauses exist for the specific insurer.

#### Scenario: No insurer-specific clauses
- **WHEN** retrieval is requested for insurer "NUEVA ASEGURADORA"
- **AND** no clauses exist for that insurer
- **THEN** the system SHALL search across all insurers
- **AND** flag results as "generic reference - verify with insurer"

### FR-4: Handle queries with no results
The system SHALL handle queries that return no matching chunks gracefully.

#### Scenario: No matching chunks
- **WHEN** a query returns zero results from the vector store
- **THEN** the system SHALL return an empty array and log a warning

### FR-5: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only.

#### Scenario: Filter by specific insurer
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** results SHALL only include chunks from AXA COLPATRIA documents

### FR-6: Pre-filter by coverage type before embedding search
The system SHALL use keyword matching as a first filter before vector similarity search to improve relevance.

#### Scenario: Hybrid search
- **WHEN** a search is performed for coverage "Incendio"
- **THEN** the system SHALL first filter chunks containing "incendio" in text, then apply similarity ranking

## Dependencies
- Supabase pgvector
- PostgreSQL full-text search
- Clause RAG Indexing (para los chunks)
