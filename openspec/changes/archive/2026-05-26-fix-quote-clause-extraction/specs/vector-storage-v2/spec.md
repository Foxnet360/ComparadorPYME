## MODIFIED Requirements

### Requirement: Store document chunks in Supabase vector database
The system SHALL store semantic chunks with their 3072-dimensional embeddings generated via `text-embedding-004` in the Supabase chunks table.

#### Scenario: Store chunk with aligned embedding
- **WHEN** a chunk is generated
- **THEN** the system SHALL call `text-embedding-004` to create a 3072-dimensional vector
- **AND** store it in the Supabase chunks table without dimensionality mismatches
