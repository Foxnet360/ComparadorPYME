## MODIFIED Requirements

### Requirement: RAG Retrieval with Query Expansion
The system SHALL retrieve relevant clause sections using hybrid search with query expansion. **ADDED**: The system SHALL batch embedding generation for query expansions.

#### Scenario: Batch query expansion embeddings
- **WHEN** a query is expanded into N variants
- **THEN** all N embeddings SHALL be generated in a single batch request
- **AND** total embedding time SHALL be approximately equal to a single request

#### Scenario: Limited concurrency for re-ranking
- **WHEN** re-ranking requires embeddings for M chunks
- **THEN** at most 5 embedding requests SHALL be in flight simultaneously
- **AND** the system SHALL not exceed Gemini rate limits

## ADDED Requirements

### Requirement: Request Coalescing for Embeddings
The system SHALL deduplicate concurrent embedding requests.

#### Scenario: Duplicate embedding requests
- **WHEN** multiple requests need the same embedding simultaneously
- **THEN** only one API call SHALL be made
- **AND** all requests SHALL share the result

### Requirement: Query Result Caching
The system SHALL cache frequent RAG queries.

#### Scenario: Cache hit
- **WHEN** a query identical to a recent one is made
- **AND** the result is in cache
- **THEN** the cached result SHALL be returned
- **AND** no database query SHALL be executed

#### Scenario: Cache TTL
- **WHEN** a cached result is older than 5 minutes
- **THEN** it SHALL be invalidated
- **AND** a fresh query SHALL be executed
