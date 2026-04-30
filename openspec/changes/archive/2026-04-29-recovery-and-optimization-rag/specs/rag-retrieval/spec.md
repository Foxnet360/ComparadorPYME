## MODIFIED Requirements

### Requirement: Retrieve relevant clause chunks for coverage analysis
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

### Requirement: Return chunks with citation metadata
The system SHALL return retrieved chunks with complete citation information for display in the analysis report.

#### Scenario: Include section reference
- **WHEN** chunks are returned from retrieval
- **THEN** each chunk SHALL include: document_name, insurer_name, section_type, coverage_tags, page_number

#### Scenario: Coverage-tagged retrieval
- **WHEN** retrieval is requested for coverage "Incendio"
- **THEN** the system SHALL use coverage_tags array for initial filtering
- **AND** then apply vector similarity ranking on the filtered subset

## ADDED Requirements

### Requirement: Cross-insurer fallback retrieval
The system SHALL fall back to generic clauses when no clauses exist for the specific insurer.

#### Scenario: No insurer-specific clauses
- **WHEN** retrieval is requested for insurer "NUEVA ASEGURADORA"
- **AND** no clauses exist for that insurer
- **THEN** the system SHALL search across all insurers
- **AND** flag results as "generic reference - verify with insurer"