## ADDED Requirements

### Requirement: Parallel Quote Processing
The system SHALL process multiple quotes in parallel instead of sequentially.

#### Scenario: Validate multiple quotes
- **WHEN** 5 quotes are uploaded for analysis
- **THEN** validation SHALL run in parallel using `Promise.all`
- **AND** total validation time SHALL be approximately equal to the slowest single quote validation

#### Scenario: Score multiple quotes
- **WHEN** scoring is calculated for 5 quotes
- **THEN** scoring SHALL run in parallel
- **AND** total scoring time SHALL be approximately equal to the slowest single quote scoring

#### Scenario: Generate narratives for multiple quotes
- **WHEN** narratives are generated for 5 quotes
- **THEN** narrative generation SHALL run in parallel with concurrency limit of 3
- **AND** total time SHALL not exceed 3x the average single narrative time

### Requirement: Batch Embedding Generation
The system SHALL batch embedding generation requests to reduce API calls.

#### Scenario: Query expansion embeddings
- **WHEN** a query is expanded into 4 variants
- **THEN** all 4 embeddings SHALL be generated in a single batch request
- **AND** the number of API calls SHALL be 1 instead of 4

#### Scenario: Re-ranking embeddings
- **WHEN** re-ranking 15 chunks
- **THEN** embeddings SHALL be generated with concurrency limit of 5
- **AND** the system SHALL not exceed Gemini rate limits

### Requirement: Request Coalescing
The system SHALL deduplicate concurrent identical embedding requests.

#### Scenario: Concurrent identical requests
- **WHEN** 10 requests ask for the same embedding simultaneously
- **THEN** only 1 embedding API call SHALL be made
- **AND** all 10 requests SHALL receive the same result

### Requirement: Frontend Code Splitting
The system SHALL split the frontend bundle into smaller chunks.

#### Scenario: Initial load
- **WHEN** a user loads the application
- **THEN** the initial bundle SHALL NOT exceed 300KB gzipped
- **AND** heavy components (ChatBot, ClauseAdmin) SHALL be lazy-loaded

#### Scenario: Modal opening
- **WHEN** a user opens the ChatBot modal
- **THEN** the ChatBot chunk SHALL be loaded on demand
- **AND** a loading spinner SHALL be shown during load

### Requirement: Memory Leak Fixes
The system SHALL fix identified memory leaks.

#### Scenario: Redis cache intervals
- **WHEN** the server receives SIGTERM or SIGINT
- **THEN** all intervals SHALL be cleared
- **AND** Redis connections SHALL be closed gracefully

#### Scenario: Analysis cache bounds
- **WHEN** the analysis cache exceeds 100 entries
- **THEN** least-recently-used entries SHALL be evicted
- **AND** entries older than 5 minutes SHALL be removed

#### Scenario: Rate limiter cleanup
- **WHEN** a rate limit entry is older than 15 minutes
- **THEN** it SHALL be automatically removed from memory

---

## Delta from change: complete-system-audit-remediation

## ADDED Requirements

### Requirement: Parallel Quote Processing
The system SHALL process multiple quotes in parallel instead of sequentially.

#### Scenario: Validate multiple quotes
- **WHEN** 5 quotes are uploaded for analysis
- **THEN** validation SHALL run in parallel using `Promise.all`
- **AND** total validation time SHALL be approximately equal to the slowest single quote validation

#### Scenario: Score multiple quotes
- **WHEN** scoring is calculated for 5 quotes
- **THEN** scoring SHALL run in parallel
- **AND** total scoring time SHALL be approximately equal to the slowest single quote scoring

#### Scenario: Generate narratives for multiple quotes
- **WHEN** narratives are generated for 5 quotes
- **THEN** narrative generation SHALL run in parallel with concurrency limit of 3
- **AND** total time SHALL not exceed 3x the average single narrative time

### Requirement: Batch Embedding Generation
The system SHALL batch embedding generation requests to reduce API calls.

#### Scenario: Query expansion embeddings
- **WHEN** a query is expanded into 4 variants
- **THEN** all 4 embeddings SHALL be generated in a single batch request
- **AND** the number of API calls SHALL be 1 instead of 4

#### Scenario: Re-ranking embeddings
- **WHEN** re-ranking 15 chunks
- **THEN** embeddings SHALL be generated with concurrency limit of 5
- **AND** the system SHALL not exceed Gemini rate limits

### Requirement: Request Coalescing
The system SHALL deduplicate concurrent identical embedding requests.

#### Scenario: Concurrent identical requests
- **WHEN** 10 requests ask for the same embedding simultaneously
- **THEN** only 1 embedding API call SHALL be made
- **AND** all 10 requests SHALL receive the same result

### Requirement: Frontend Code Splitting
The system SHALL split the frontend bundle into smaller chunks.

#### Scenario: Initial load
- **WHEN** a user loads the application
- **THEN** the initial bundle SHALL NOT exceed 300KB gzipped
- **AND** heavy components (ChatBot, ClauseAdmin) SHALL be lazy-loaded

#### Scenario: Modal opening
- **WHEN** a user opens the ChatBot modal
- **THEN** the ChatBot chunk SHALL be loaded on demand
- **AND** a loading spinner SHALL be shown during load

### Requirement: Memory Leak Fixes
The system SHALL fix identified memory leaks.

#### Scenario: Redis cache intervals
- **WHEN** the server receives SIGTERM or SIGINT
- **THEN** all intervals SHALL be cleared
- **AND** Redis connections SHALL be closed gracefully

#### Scenario: Analysis cache bounds
- **WHEN** the analysis cache exceeds 100 entries
- **THEN** least-recently-used entries SHALL be evicted
- **AND** entries older than 5 minutes SHALL be removed

#### Scenario: Rate limiter cleanup
- **WHEN** a rate limit entry is older than 15 minutes
- **THEN** it SHALL be automatically removed from memory
