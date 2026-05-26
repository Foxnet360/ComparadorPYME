## ADDED Requirements

### Requirement: Search structured clause JSON
The system SHALL search within structured clause JSON documents stored in PostgreSQL in addition to vector chunks.

#### Scenario: Search structured clause data
- **WHEN** a user searches for "deducible terremoto CHUBB"
- **THEN** the system queries the `structured_clauses` table
- **AND** returns the exact deductible from the JSON structure
- **AND" response time is under 100ms

### Requirement: Expand queries automatically
The system SHALL expand search queries using the thesaurus before executing searches.

#### Scenario: Expanded search
- **WHEN** searching for "franquicia incendio"
- **THEN** the system expands to include "deducible amparo básico"
- **AND" searches for all variants

## MODIFIED Requirements

### Requirement: Retrieve clause chunks via vector similarity
The system SHALL retrieve clause document chunks using vector similarity search.

#### Scenario: Basic vector search
- **WHEN** a coverage name is provided for cross-reference
- **THEN** the system generates an embedding for the coverage name
- **AND" searches the clause chunk vector index for similar chunks
- **AND" returns chunks with similarity above the configured threshold

### Requirement: Support hybrid search
The system SHALL combine vector similarity with full-text search for better retrieval.

#### Scenario: Hybrid clause search
- **WHEN** searching for clause information
- **THEN" the system performs both vector similarity and keyword search
- **AND" combines results using configurable alpha weighting
- **AND" returns the top N most relevant chunks

## REMOVED Requirements

### Requirement: Chunk-based clause storage as primary format
**Reason**: Replaced by structured JSON extraction which preserves legal relationships
**Migration**: Existing chunks remain in vector storage for backward compatibility, but primary search targets structured_clauses table
