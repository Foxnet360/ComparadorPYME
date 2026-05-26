## ADDED Requirements

### Requirement: Implement parent-child retrieval
The system SHALL support retrieving parent documents when child chunks match, providing full context.

#### Scenario: Parent retrieval for deductible
- **WHEN** a child chunk about "deducible 10%" matches
- **THEN** the system also retrieves the parent section containing the full coverage description
- **AND" the parent includes coverage name, description, and all conditions

### Requirement: Add re-ranking to search results
The system SHALL re-rank initial search results using a cross-encoder model for better relevance.

#### Scenario: Re-rank search results
- **WHEN** an initial search returns 20 candidate chunks
- **THEN** a cross-encoder re-ranks them by relevance to the query
- **AND" the top 5 most relevant are returned to the user

### Requirement: Support hybrid search scoring
The system SHALL combine vector similarity and full-text (BM25) scores with configurable weights.

#### Scenario: Hybrid search for clause
- **WHEN** searching for "exclusión terremoto"
- **THEN** the system performs both vector and BM25 searches
- **AND" combines scores with alpha=0.7 (70% vector, 30% keyword)
- **AND" returns the best combined results

### Requirement: Enable filtered semantic search
The system SHALL allow filtering search results by insurer, coverage type, and document section.

#### Scenario: Filtered search
- **WHEN** searching for "deducible" filtered by insurer="CHUBB"
- **THEN** only CHUBB clauses are searched
- **AND** results are further filterable by coverage type or section
