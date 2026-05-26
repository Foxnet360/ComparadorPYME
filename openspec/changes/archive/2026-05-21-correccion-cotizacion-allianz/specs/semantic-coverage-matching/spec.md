# Spec: Semantic Coverage Matching (Delta)

## Delta for: semantic-coverage-matching

## Changes

### MODIFIED Requirements

#### Requirement: FR-1 updated - Batch embedding processing
The embedding layer (capa 3) SHALL use batch processing.

##### Scenario: Batch embedding match
- **WHEN** multiple coverages fail thesaurus and fuzzy matching
- **THEN** the system SHALL collect them into a batch
- **AND** send ONE API call for all coverages in the batch
- **AND** receive embeddings for all coverages in the response
- **AND** compare each with category embeddings
- **AND** assign matches with cosine similarity > 0.7

##### Scenario: Hybrid matching order
- **WHEN** normalizing coverages
- **THEN** the system SHALL:
  1. Check thesaurus exact match (instant)
  2. Check fuzzy match with Levenshtein < 3 (instant)
  3. Check persistent cache for embedding (fast, <50ms)
  4. Generate batch embedding for remaining coverages (~7s per batch)
  5. Compare with category embeddings
  6. For confidence < 0.6, use LLM fallback

#### Requirement: FR-4 updated - Performance target
The performance target SHALL be updated to account for batch processing.

##### Scenario: 15 coverage quote
- **WHEN** a quote has 15 coverages
- **THEN** total matching time SHALL be < 30 seconds
- **AND** thesaurus/fuzzy matches SHALL be instant
- **AND** cache hits SHALL be < 50ms each
- **AND** batch embedding SHALL take < 10 seconds for all unmatched coverages

##### Scenario: 22 coverage quote
- **WHEN** a quote has 22 coverages
- **THEN** total matching time SHALL be < 45 seconds
- **AND** batches SHALL be split into groups of 10

### ADDED Requirements

#### Requirement: Persistent cache integration
The matching system SHALL use persistent embedding cache.

##### Scenario: Cache lookup in matching pipeline
- **BEFORE** generating embeddings
- **WHEN** a coverage needs embedding
- **THEN** the system SHALL check persistent cache (Supabase) first
- **AND** only generate embeddings for cache misses

#### Requirement: Batch similarity computation
The system SHALL compute similarities efficiently for batches.

##### Scenario: Matrix similarity computation
- **WHEN** 10 coverage embeddings are ready
- **THEN** compute cosine similarity against 14 category embeddings using matrix operations
- **AND** return best match for each coverage

## Dependencies
- `batch-embedding-normalization` for batch API calls
- `embedding-cache-persistent` for cache storage
