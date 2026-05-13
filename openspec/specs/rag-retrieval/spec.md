# RAG Retrieval

## Capability
Recuperación de chunks de cláusulas relevantes usando búsqueda híbrida (vectorial + full-text) con filtrado por aseguradora y cobertura, score threshold configurable, normalización de nombres de aseguradoras, y extracción de cláusulas desde PDFs fuente.

## User Story
**Como** sistema de análisis
**Quiero** recuperar cláusulas relevantes para una cobertura específica
**Para** cross-referenciar con cotizaciones

## ADDED Requirements

### FR-1: Retrieve relevant clause chunks for coverage analysis
The system SHALL retrieve clause chunks relevant to a specific coverage from the vector store when analyzing a quote.

#### Scenario: Search for coverage exclusions
- **WHEN** analyzing a coverage like "Responsabilidad Civil"
- **THEN** the system SHALL retrieve chunks containing exclusions, limitations, and conditions related to that coverage
- **AND** the search uses hybrid vector + full-text search
- **AND** results are filtered by insurer_name and coverage_tags
- **AND** only chunks with similarity score >= 0.7 are returned

#### Scenario: Search by multiple terms
- **WHEN** a search includes multiple terms like ["terremoto", "exclusión", "deducible"]
- **THEN** the system SHALL combine the terms into a single embedding query
- **AND** use the coverage_tags array for pre-filtering
- **AND** apply minimum score threshold before returning results

### FR-2: Return chunks with citation metadata
The system SHALL return retrieved chunks with complete citation information for display in the analysis report.

#### Scenario: Include section reference
- **WHEN** chunks are returned from retrieval
- **THEN** each chunk SHALL include: document_name, insurer_name, section_type, coverage_tags, page_number, similarity_score

#### Scenario: Coverage-tagged retrieval
- **WHEN** retrieval is requested for coverage "Incendio"
- **THEN** the system SHALL use coverage_tags array for initial filtering
- **AND** then apply vector similarity ranking on the filtered subset
- **AND** exclude chunks below the configured minimum threshold

#### Scenario: Limit results
- **WHEN** a retrieval request specifies a limit
- **THEN** the system SHALL return no more than the specified number of chunks (default 15 initial, 5 after filtering)
- **AND** only after applying score threshold filtering

### FR-3: Handle queries with no results
The system SHALL handle queries that return no matching chunks gracefully.

#### Scenario: No matching chunks
- **WHEN** a query returns zero results from the vector store
- **THEN** the system SHALL return an empty array and log a warning
- **AND** NOT attempt cross-insurer fallback

### FR-4: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only.

#### Scenario: Filter by specific insurer
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** results SHALL only include chunks from AXA COLPATRIA documents
- **AND** if no chunks exist for AXA, return empty array with message "Sin cláusulas disponibles"
- **AND** the system SHALL normalize insurer names (e.g., "AXA COLPATRIA SEGUROS S.A." → "AXA Colpatria")

### FR-5: Pre-filter by coverage type before embedding search
The system SHALL use keyword matching as a first filter before vector similarity search to improve relevance.

#### Scenario: Hybrid search
- **WHEN** a search is performed for coverage "Incendio"
- **THEN** the system SHALL first filter chunks containing "incendio" in text or coverage_tags
- **AND** then apply similarity ranking with score threshold

## ADDED Requirements

### FR-6: Configurable minimum relevance score
The system SHALL support configurable minimum similarity scores for chunk retrieval.

#### Scenario: Default threshold
- **WHEN** no custom threshold is configured
- **THEN** the system uses minimum similarity score of 0.7

#### Scenario: Below threshold
- **WHEN** retrieved chunks have similarity < 0.7
- **THEN** they are excluded from results
- **AND** the system returns empty array if no chunks meet threshold

### FR-7: Anti-hallucination prompt constraints
The system SHALL include anti-hallucination instructions in all LLM prompts that use retrieved chunks.

#### Scenario: Prompt with constraints
- **WHEN** building prompt for cross-reference using retrieved chunks
- **THEN** the prompt SHALL include: "Use ONLY information from the provided context. If not found, respond 'No encontrado en cláusulas'."
- **AND** the prompt SHALL include: "Do NOT infer or calculate values not explicitly stated in the context."

### FR-8: Insurer name normalization
The system SHALL normalize insurer names from quotes to match database names.

#### Scenario: Name normalization
- **WHEN** a quote extracts insurer name as "SBS SEGUROS COLOMBIA S.A."
- **THEN** the system normalizes it to "SBS" for RAG retrieval
- **AND** uses normalized name for clause lookups

## REMOVED Requirements

### Requirement: Cross-insurer fallback retrieval
**Reason**: Cross-insurer fallback causes hallucinations by using irrelevant clause content from other insurers. It provides false confidence and undermines trust.
**Migration**: Systems using `searchWithFallback` MUST update to handle empty results explicitly. Use `checkInsurerHasClauses()` pre-flight check to determine availability.

## MODIFIED Requirements

### FR-7: Batch coverage queries
**Reason**: Previous implementation queried RAG once per insurer per coverage, causing N×M queries and timeouts

#### Scenario: Single query per coverage
- **WHEN** cross-referencing 14 coverages across 4 insurers
- **THEN** the system SHALL perform exactly 14 RAG queries (one per coverage)
- **AND** results SHALL be distributed to all insurers that have the coverage
- **AND** total RAG time SHALL be < 30 seconds

#### Scenario: Distribute batch results
- **WHEN** a batch query for "Incendio" returns 5 chunks
- **THEN** all insurers with Incendio coverage SHALL receive the same chunks
- **AND** insurer-specific chunks SHALL be tagged with insurer name

### FR-8: Insurer-aware skipping
**Reason**: Previous implementation queried RAG for insurers with no indexed clauses, wasting time and causing timeouts

#### Scenario: Skip non-indexed insurers
- **WHEN** an insurer has zero clauses in the vector store
- **THEN** the system SHALL skip RAG queries for that insurer entirely
- **AND** log: "No clauses indexed for {insurer}, skipping RAG"

#### Scenario: Pre-flight availability check
- **WHEN** starting cross-reference phase
- **THEN** the system SHALL first check which insurers have indexed clauses
- **AND** only perform RAG for those insurers

### FR-9: Extract clauses from source PDFs
**Reason**: Many quote PDFs contain clauses at the end that are not indexed separately

#### Scenario: Extract from quote PDF
- **WHEN** a quote PDF has text beyond the coverage table (clauses section)
- **THEN** the system SHALL extract that text as temporary clause chunks
- **AND** use them for cross-referencing without storing in vector DB

#### Scenario: Merge with indexed clauses
- **WHEN** both indexed clauses and PDF-extracted clauses exist for a coverage
- **THEN** the system SHALL merge both sources
- **AND** prioritize indexed clauses for citation

## Dependencies
- Supabase pgvector
- PostgreSQL full-text search
- Clause RAG Indexing (para los chunks)
