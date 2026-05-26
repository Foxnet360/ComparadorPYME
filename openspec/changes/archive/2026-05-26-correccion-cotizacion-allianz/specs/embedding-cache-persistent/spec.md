# Spec: Embedding Cache Persistent

## Capability
Almacenamiento persistente de embeddings de coberturas en Supabase para evitar recálculo entre análisis y reinicios del servidor.

## User Story
**Como** administrador del sistema
**Quiero** que los embeddings calculados se guarden permanentemente
**Para** no depender de cache en memoria que se pierde al reiniciar

## Requirements

### Requirement: Supabase table for embeddings
The system SHALL store coverage embeddings in a dedicated Supabase table.

#### Scenario: Table structure
- **WHEN** the system initializes
- **THEN** a table `coverage_embeddings_cache` SHALL exist with columns:
  - `id`: serial primary key
  - `coverage_name`: text, normalized lowercase
  - `embedding`: vector(3072) or jsonb array of floats
  - `model`: text (e.g., "gemini-embedding-001")
  - `dimensions`: integer (e.g., 3072)
  - `created_at`: timestamp
  - `updated_at`: timestamp
  - UNIQUE constraint on (`coverage_name`, `model`)

#### Scenario: Migration for table creation
- **WHEN** deploying the change
- **THEN** a Supabase migration SHALL create the table
- **AND** add appropriate indexes for fast lookup

### Requirement: Cache lookup before API call
The system SHALL check persistent cache before calling Gemini API.

#### Scenario: Cache hit
- **WHEN** a coverage name needs embedding
- **THEN** the system SHALL query Supabase first
- **AND** if found, return the cached embedding
- **AND** bypass the Gemini API call

#### Scenario: Cache miss
- **WHEN** a coverage name is not in Supabase cache
- **THEN** the system SHALL call Gemini API
- **AND** store the result in Supabase
- **AND** return the new embedding

#### Scenario: In-memory cache layer
- **WHEN** an embedding is retrieved from Supabase
- **THEN** the system SHALL also store it in local memory cache
- **AND** subsequent lookups SHALL use memory first
- **AND** memory cache SHALL have TTL (e.g., 1 hour)

### Requirement: Cache invalidation
The system SHALL handle cache invalidation when embeddings become stale.

#### Scenario: Model version change
- **WHEN** the embedding model changes (e.g., gemini-embedding-001 → gemini-embedding-002)
- **THEN** the system SHALL detect the model mismatch
- **AND** invalidate cache entries for the old model
- **AND** regenerate embeddings with the new model

#### Scenario: Manual cache refresh
- **WHEN** an administrator triggers cache refresh
- **THEN** the system SHALL clear the cache
- **AND** regenerate embeddings for all unique coverage names encountered

### Requirement: Batch cache operations
The system SHALL support batch cache lookups and inserts.

#### Scenario: Batch lookup
- **WHEN** processing a batch of 10 coverage names
- **THEN** the system SHALL query Supabase with IN clause
- **AND** return all matching embeddings in one query

#### Scenario: Batch insert
- **WHEN** generating embeddings for a batch
- **THEN** the system SHALL insert all results in one query
- **AND** use ON CONFLICT DO UPDATE for upserts

### Requirement: Cache performance
The system SHALL maintain cache performance targets.

#### Scenario: Lookup latency
- **WHEN** querying the cache
- **THEN** response time SHALL be < 50ms
- **AND** index on coverage_name SHALL be used

#### Scenario: Storage efficiency
- **WHEN** storing embeddings
- **THEN** the system SHALL compress or use vector type efficiently
- **AND** storage per embedding SHALL be ~12KB (3072 floats × 4 bytes)

### Requirement: Cache fallback on Supabase failure
The system SHALL handle Supabase failures gracefully.

#### Scenario: Supabase unavailable
- **WHEN** Supabase query fails
- **THEN** the system SHALL fall back to memory cache
- **AND** if memory miss, call Gemini API directly
- **AND** log the Supabase failure
- **AND** SHALL NOT fail the quote analysis

## Dependencies
- Supabase PostgreSQL with pgvector extension
- `semantic-coverage-matching` for embedding usage
- `batch-embedding-normalization` for batch operations
