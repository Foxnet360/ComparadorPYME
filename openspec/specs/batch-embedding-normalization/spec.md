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

#### Scenario: Batch of 100 coverages
- **WHEN** a quote or clause has up to 100 coverages to normalize
- **THEN** the system SHALL send all names in ONE API call
- **AND** receive up to 100 embeddings in the response
- **AND** the call SHALL complete in < 10 seconds total

#### Scenario: Batch size limit
- **WHEN** a document has more than 100 coverages to process
- **THEN** the system SHALL process them in batches of 100
- **AND** process batches sequentially with a small delay to avoid rate limits

### Requirement: Batch comparison with categories
The system SHALL compare batched coverage embeddings against canonical category embeddings efficiently.

#### Scenario: Batch similarity computation
- **WHEN** 100 coverage embeddings are generated
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

#### Scenario: 100 coverage quote
- **WHEN** a quote has 100 coverages
- **THEN** normalization SHALL complete in < 30 seconds
- **AND** thesaurus/fuzzy matches SHALL be instant
- **AND** embedding batch SHALL take < 10 seconds

#### Scenario: 200 coverage clause
- **WHEN** a clause has 200 coverages
- **THEN** normalization SHALL complete in < 45 seconds
- **AND** batches SHALL be processed without timeouts

## Dependencies
- `semantic-coverage-matching` for the matching cascade
- `embedding-cache-persistent` for caching layer
- Gemini API for batch embedding generation

---

## Delta from change: high-certainty-ontology-redesign

- Updated batch size from 10 to 100
- Updated performance targets for batch of 100
