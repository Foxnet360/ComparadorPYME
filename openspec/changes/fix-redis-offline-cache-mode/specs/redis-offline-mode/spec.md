## ADDED Requirements

### Requirement: Cache service operates with or without Redis
The system SHALL provide a cache service that transparently uses Redis when available and falls back to in-memory storage when Redis is unavailable, without requiring code changes in consuming services.

#### Scenario: Redis is available
- **WHEN** the server starts and Redis responds to a ping
- **THEN** the cache service uses Redis for all operations
- **AND** all existing cache functionality works unchanged

#### Scenario: Redis is unavailable
- **WHEN** the server starts and Redis does not respond
- **THEN** the cache service automatically uses in-memory storage
- **AND** no errors are thrown to consuming services
- **AND** the system logs a single warning about Redis unavailability

#### Scenario: Redis becomes unavailable at runtime
- **WHEN** Redis connection is lost during operation
- **THEN** the cache service switches to in-memory storage
- **AND** subsequent cache operations succeed without errors
- **AND** the system periodically checks (every 60 seconds) if Redis has recovered

### Requirement: In-memory cache supports TTL
The in-memory cache SHALL support time-to-live (TTL) expiration identical to Redis `setex` behavior.

#### Scenario: Cache entry expires
- **WHEN** a value is stored with a TTL of 3600 seconds
- **THEN** the value is retrievable within 3600 seconds
- **AND** the value is not retrievable after 3600 seconds
- **AND** expired entries are cleaned up to prevent memory leaks

#### Scenario: Cache cleanup runs periodically
- **WHEN** the in-memory cache contains entries
- **THEN** expired entries are removed every 5 minutes
- **AND** the cleanup process does not block other operations

### Requirement: In-memory cache has size limits
The in-memory cache SHALL enforce maximum size limits with LRU eviction to prevent unbounded memory growth.

#### Scenario: Cache reaches maximum size
- **WHEN** the in-memory cache reaches 10,000 entries
- **THEN** the least recently used entries are evicted
- **AND** new entries can still be stored
- **AND** the system logs a warning about cache eviction

### Requirement: ioredis error events are handled
The system SHALL handle ioredis error events without crashing or spamming logs.

#### Scenario: Redis connection fails repeatedly
- **WHEN** Redis connection fails
- **THEN** the first error is logged as a warning
- **AND** subsequent errors are suppressed for 60 seconds
- **AND** Node.js process does not crash from unhandled events
- **AND** no `[ioredis] Unhandled error event` messages appear in logs

### Requirement: Category embeddings are precalculated
The system SHALL precalculate embeddings for all 14 canonical coverage categories at startup to eliminate redundant API calls.

#### Scenario: First quote analysis
- **WHEN** the first quote is analyzed after server start
- **THEN** embeddings for all 14 canonical categories are already computed
- **AND** no Gemini API calls are needed for category embeddings during quote processing

#### Scenario: Multiple quotes analyzed
- **WHEN** multiple quotes are analyzed
- **THEN** category embeddings are computed exactly once
- **AND** subsequent quotes reuse the cached embeddings

### Requirement: Quote processing timeout is reduced
The system SHALL fail faster when quote extraction takes too long.

#### Scenario: Multimodal extraction timeout
- **WHEN** multimodal PDF extraction exceeds 2 minutes
- **THEN** the operation times out
- **AND** the system attempts legacy text extraction as fallback
- **AND** if legacy also fails, the quote is marked with a processing error

#### Scenario: Legacy extraction timeout
- **WHEN** legacy text extraction exceeds 2 minutes
- **THEN** the operation times out
- **AND** the quote is marked with a processing error
- **AND** the analysis continues with remaining quotes
