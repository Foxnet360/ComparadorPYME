# RAG Retrieval

## ADDED Requirements

### Requirement: Retrieve relevant clause chunks for coverage analysis
The system SHALL retrieve clause chunks relevant to a specific coverage from the vector store when analyzing a quote.

#### Scenario: Search for coverage exclusions
- **WHEN** analyzing a coverage like "Responsabilidad Civil"
- **THEN** the system SHALL retrieve chunks containing exclusions, limitations, and conditions related to that coverage

#### Scenario: Search by multiple terms
- **WHEN** a search includes multiple terms like ["terremoto", "exclusión", "deducible"]
- **THEN** the system SHALL combine the terms into a single embedding query

### Requirement: Return chunks with citation metadata
The system SHALL return retrieved chunks with complete citation information for display in the analysis report.

#### Scenario: Include section reference
- **WHEN** chunks are returned from retrieval
- **THEN** each chunk SHALL include: document_name, section_title, clause_id, page_numbers

#### Scenario: Limit results
- **WHEN** a retrieval request specifies a limit
- **THEN** the system SHALL return no more than the specified number of chunks (default 5)

### Requirement: Handle queries with no results
The system SHALL handle queries that return no matching chunks gracefully.

#### Scenario: No matching chunks
- **WHEN** a query returns zero results from the vector store
- **THEN** the system SHALL return an empty array and log a warning

### Requirement: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only.

#### Scenario: Filter by specific insurer
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** results SHALL only include chunks from AXA COLPATRIA documents

### Requirement: Pre-filter by coverage type before embedding search
The system SHALL use keyword matching as a first filter before vector similarity search to improve relevance.

#### Scenario: Hybrid search
- **WHEN** a search is performed for coverage "Incendio"
- **THEN** the system SHALL first filter chunks containing "incendio" in text, then apply similarity ranking
