# Spec: Batch Embedding Normalization

## Capability
Procesamiento por lotes de embeddings de coberturas para reducir llamadas a la API de Gemini y acelerar la normalización de cotizaciones.

## User Story
**Como** usuario del comparador
**Quiero** que el análisis de cotizaciones sea rápido
**Para** no esperar minutos por cada cotización

## Requirements

### Requirement: Batch embedding generation
The system SHALL generate embeddings for multiple coverage names in a single API call.

#### Scenario: Batch of 10 coverages
- **WHEN** a quote has 10 coverages to normalize
- **THEN** the system SHALL send all 10 names in ONE API call
- **AND** receive 10 embeddings in the response
- **AND** the call SHALL take ~7 seconds total (not 70 seconds)

#### Scenario: Batch of 20 coverages
- **WHEN** a quote has 20 coverages to normalize
- **THEN** the system SHALL process them in 2 batches of 10
- **AND** total embedding time SHALL be ~14 seconds (not 140 seconds)

#### Scenario: Batch size limit
- **WHEN** a quote has more than 20 coverages
- **THEN** the system SHALL process in batches of 10
- **AND** process batches sequentially to avoid rate limits

### Requirement: Batch comparison with categories
The system SHALL compare batched coverage embeddings against canonical category embeddings efficiently.

#### Scenario: Batch similarity computation
- **WHEN** 10 coverage embeddings are generated
- **THEN** the system SHALL compute cosine similarity against all 14 category embeddings
- **AND** use matrix operations for efficiency
- **AND** return the best match for each coverage

#### Scenario: Batch confidence threshold
- **WHEN** computing similarities in batch
- **THEN** the system SHALL apply the same threshold (0.7 for embeddings)
- **AND** flag low-confidence matches for LLM fallback
- **AND** the batch processing SHALL NOT change match quality

### Requirement: Preserve existing matching behavior
The system SHALL maintain the same 4-layer matching cascade but optimize the embedding layer.

#### Scenario: Thesaurus still checked first
- **WHEN** a coverage matches the thesaurus exactly
- **THEN** the system SHALL NOT generate an embedding for it
- **AND** shall return thesaurus match immediately

#### Scenario: Fuzzy still checked before embeddings
- **WHEN** a coverage has fuzzy match with Levenshtein < 3
- **THEN** the system SHALL NOT generate an embedding for it
- **AND** shall return fuzzy match with calculated confidence

#### Scenario: Embedding layer only for unmatched
- **WHEN** a coverage fails thesaurus and fuzzy matching
- **THEN** the system SHALL add it to the batch for embedding generation
- **AND** process the entire batch together

### Requirement: Cache integration with batching
The system SHALL check cache before adding to batch.

#### Scenario: Cache hit skips batch
- **WHEN** a coverage's embedding exists in cache (memory or Supabase)
- **THEN** the system SHALL use cached embedding
- **AND** exclude it from the batch API call

#### Scenario: Batch results cached
- **WHEN** embeddings are generated in a batch
- **THEN** the system SHALL store ALL results in cache
- **AND** cache key SHALL be the normalized coverage name

### Requirement: Performance targets
The system SHALL meet performance targets for normalization.

#### Scenario: 15 coverage quote
- **WHEN** a quote has 15 coverages
- **THEN** normalization SHALL complete in < 30 seconds
- **AND** thesaurus/fuzzy matches SHALL be instant
- **AND** embedding batch SHALL take < 10 seconds

#### Scenario: 22 coverage quote
- **WHEN** a quote has 22 coverages
- **THEN** normalization SHALL complete in < 45 seconds
- **AND** batches SHALL be processed without timeouts

## Dependencies
- `semantic-coverage-matching` for the matching cascade
- `embedding-cache-persistent` for caching layer
- Gemini API for batch embedding generation

---

## Delta from change: correccion-cotizacion-allianz

# Spec: Batch Embedding Normalization

## Capability
Procesamiento por lotes de embeddings de coberturas para reducir llamadas a la API de Gemini y acelerar la normalización de cotizaciones.

## User Story
**Como** usuario del comparador
**Quiero** que el análisis de cotizaciones sea rápido
**Para** no esperar minutos por cada cotización

## Requirements

### Requirement: Batch embedding generation
The system SHALL generate embeddings for multiple coverage names in a single API call.

#### Scenario: Batch of 10 coverages
- **WHEN** a quote has 10 coverages to normalize
- **THEN** the system SHALL send all 10 names in ONE API call
- **AND** receive 10 embeddings in the response
- **AND** the call SHALL take ~7 seconds total (not 70 seconds)

#### Scenario: Batch of 20 coverages
- **WHEN** a quote has 20 coverages to normalize
- **THEN** the system SHALL process them in 2 batches of 10
- **AND** total embedding time SHALL be ~14 seconds (not 140 seconds)

#### Scenario: Batch size limit
- **WHEN** a quote has more than 20 coverages
- **THEN** the system SHALL process in batches of 10
- **AND** process batches sequentially to avoid rate limits

### Requirement: Batch comparison with categories
The system SHALL compare batched coverage embeddings against canonical category embeddings efficiently.

#### Scenario: Batch similarity computation
- **WHEN** 10 coverage embeddings are generated
- **THEN** the system SHALL compute cosine similarity against all 14 category embeddings
- **AND** use matrix operations for efficiency
- **AND** return the best match for each coverage

#### Scenario: Batch confidence threshold
- **WHEN** computing similarities in batch
- **THEN** the system SHALL apply the same threshold (0.7 for embeddings)
- **AND** flag low-confidence matches for LLM fallback
- **AND** the batch processing SHALL NOT change match quality

### Requirement: Preserve existing matching behavior
The system SHALL maintain the same 4-layer matching cascade but optimize the embedding layer.

#### Scenario: Thesaurus still checked first
- **WHEN** a coverage matches the thesaurus exactly
- **THEN** the system SHALL NOT generate an embedding for it
- **AND** shall return thesaurus match immediately

#### Scenario: Fuzzy still checked before embeddings
- **WHEN** a coverage has fuzzy match with Levenshtein < 3
- **THEN** the system SHALL NOT generate an embedding for it
- **AND** shall return fuzzy match with calculated confidence

#### Scenario: Embedding layer only for unmatched
- **WHEN** a coverage fails thesaurus and fuzzy matching
- **THEN** the system SHALL add it to the batch for embedding generation
- **AND** process the entire batch together

### Requirement: Cache integration with batching
The system SHALL check cache before adding to batch.

#### Scenario: Cache hit skips batch
- **WHEN** a coverage's embedding exists in cache (memory or Supabase)
- **THEN** the system SHALL use cached embedding
- **AND** exclude it from the batch API call

#### Scenario: Batch results cached
- **WHEN** embeddings are generated in a batch
- **THEN** the system SHALL store ALL results in cache
- **AND** cache key SHALL be the normalized coverage name

### Requirement: Performance targets
The system SHALL meet performance targets for normalization.

#### Scenario: 15 coverage quote
- **WHEN** a quote has 15 coverages
- **THEN** normalization SHALL complete in < 30 seconds
- **AND** thesaurus/fuzzy matches SHALL be instant
- **AND** embedding batch SHALL take < 10 seconds

#### Scenario: 22 coverage quote
- **WHEN** a quote has 22 coverages
- **THEN** normalization SHALL complete in < 45 seconds
- **AND** batches SHALL be processed without timeouts

## Dependencies
- `semantic-coverage-matching` for the matching cascade
- `embedding-cache-persistent` for caching layer
- Gemini API for batch embedding generation
