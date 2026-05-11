## MODIFIED Requirements

### Requirement: Retrieve relevant clause chunks for coverage analysis
The system SHALL retrieve clause chunks relevant to a specific coverage from the unified vector store when analyzing a quote.

#### Scenario: Search for coverage exclusions
- **WHEN** analyzing a coverage like "Responsabilidad Civil"
- **THEN** the system SHALL retrieve chunks from `chunks` table containing exclusions, limitations, and conditions
- **AND** the search SHALL filter by `document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')`
- **AND** the search uses hybrid vector + full-text search
- **AND** results are filtered by insurer_name and coverage_tags

#### Scenario: Search by multiple terms
- **WHEN** a search includes multiple terms like ["terremoto", "exclusión", "deducible"]
- **THEN** the system SHALL combine the terms into a single embedding query
- **AND** use the coverage_tags array for pre-filtering
- **AND** filter by document_type to only search clause documents

### Requirement: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only.

#### Scenario: Filter by specific insurer
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** results SHALL only include chunks from AXA COLPATRIA clause documents
- **AND** the filter SHALL use `document_type` to ensure only clauses are returned
