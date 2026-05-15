## MODIFIED Requirements

### Requirement: Retrieve relevant clause chunks for coverage analysis
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

### Requirement: Return chunks with citation metadata
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
- **THEN** the system SHALL return no more than the specified number of chunks (default 5)
- **AND** only after applying score threshold filtering

### Requirement: Handle queries with no results
The system SHALL handle queries that return no matching chunks gracefully.

#### Scenario: No matching chunks
- **WHEN** a query returns zero results from the vector store
- **THEN** the system SHALL return an empty array and log a warning
- **AND** NOT attempt cross-insurer fallback

### Requirement: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only.

#### Scenario: Filter by specific insurer
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** results SHALL only include chunks from AXA COLPATRIA documents
- **AND** if no chunks exist for AXA, return empty array with message "Sin cláusulas disponibles"

### Requirement: Pre-filter by coverage type before embedding search
The system SHALL use keyword matching as a first filter before vector similarity search to improve relevance.

#### Scenario: Hybrid search
- **WHEN** a search is performed for coverage "Incendio"
- **THEN** the system SHALL first filter chunks containing "incendio" in text or coverage_tags
- **AND** then apply similarity ranking with score threshold

## REMOVED Requirements

### Requirement: Cross-insurer fallback retrieval
**Reason**: Cross-insurer fallback causes hallucinations by using irrelevant clause content from other insurers. It provides false confidence and undermines trust.
**Migration**: Systems using `searchWithFallback` MUST update to handle empty results explicitly. Use `checkInsurerHasClauses()` pre-flight check to determine availability.

## ADDED Requirements

### Requirement: Configurable minimum relevance score
The system SHALL support configurable minimum similarity scores for chunk retrieval.

#### Scenario: Default threshold
- **WHEN** no custom threshold is configured
- **THEN** the system uses minimum similarity score of 0.7

#### Scenario: Below threshold
- **WHEN** retrieved chunks have similarity < 0.7
- **THEN** they are excluded from results
- **AND** the system returns empty array if no chunks meet threshold

### Requirement: Anti-hallucination prompt constraints
The system SHALL include anti-hallucination instructions in all LLM prompts that use retrieved chunks.

#### Scenario: Prompt with constraints
- **WHEN** building prompt for cross-reference using retrieved chunks
- **THEN** the prompt SHALL include: "Use ONLY information from the provided context. If not found, respond 'No encontrado en cláusulas'."
