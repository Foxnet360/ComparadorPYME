# Delta for Coverage Post-Normalization

## MODIFIED Requirements

### Requirement: Map raw coverages to canonical categories
The system SHALL map each raw coverage name to one of the 14 canonical PYME categories using a 4-layer matching system. Unmapped coverages flagged for manual review SHALL be queryable via a dedicated API endpoint.
(Previously: Unmapped coverages were stored in coverage_mappings with needs_human_review=true but had no dedicated API for operations staff to query them.)

#### Scenario: Exact thesaurus match
- **WHEN** a raw coverage name exactly matches a thesaurus entry
- **THEN** the system SHALL return the canonical name with confidence 100%
- **AND** matchMethod SHALL be "thesaurus"

#### Scenario: Fuzzy match with threshold
- **WHEN** a raw coverage has fuzzy similarity >= 80% with a canonical name
- **THEN** the system SHALL return the canonical name with confidence = similarity%
- **AND** matchMethod SHALL be "fuzzy"

#### Scenario: Embedding similarity match
- **WHEN** no thesaurus or fuzzy match is found
- **THEN** the system SHALL generate embeddings for raw name and canonical names
- **AND** if cosine similarity >= 0.85, return canonical name with confidence = similarity%
- **AND** matchMethod SHALL be "embedding"

#### Scenario: LLM fallback match
- **WHEN** no embedding match is found
- **THEN** the system SHALL call Gemini to classify the coverage
- **AND** if confidence >= 70%, return canonical name
- **AND** matchMethod SHALL be "llm"

#### Scenario: No match found
- **WHEN** no match is found across all 4 layers
- **THEN** the system SHALL keep the raw name
- **AND** set canonicalName to null
- **AND** set confidence to 0
- **AND** flag for manual review

#### Scenario: No match triggers review queue entry
- **GIVEN** no match is found across all 4 layers for a coverage
- **WHEN** the mapping is saved
- **THEN** coverage_mappings.needs_human_review SHALL be set to true
- **AND** the entry SHALL be queryable via GET /api/review-queue/coverages

## ADDED Requirements

### Requirement: Review queue API endpoint
The system SHALL expose a paginated endpoint to query coverages awaiting human review.

#### Scenario: Query review queue
- **GIVEN** entries exist with needs_human_review=true
- **WHEN** GET /api/review-queue/coverages is called
- **THEN** the response SHALL include unmapped coverage entries with rawName, insurer, quoteId, and createdAt
- **AND** results SHALL be paginated with default page size 20

#### Scenario: Empty review queue
- **GIVEN** no entries have needs_human_review=true
- **WHEN** GET /api/review-queue/coverages is called
- **THEN** the response SHALL return an empty array
- **AND** total count SHALL be 0

### Requirement: Review queue API filtering
The system SHALL support filtering the review queue by insurer, date range, and domain.

#### Scenario: Filter by insurer
- **GIVEN** review queue entries exist for multiple insurers
- **WHEN** GET /api/review-queue/coverages?insurer=SBS is called
- **THEN** only entries for insurer "SBS" SHALL be returned

#### Scenario: Filter by date range
- **GIVEN** review queue entries span multiple dates
- **WHEN** GET /api/review-queue/coverages?from=2026-06-01&to=2026-06-10 is called
- **THEN** only entries within the date range SHALL be returned

#### Scenario: Filter by domain
- **GIVEN** review queue entries exist for pyme and vivienda domains
- **WHEN** GET /api/review-queue/coverages?domain=pyme is called
- **THEN** only entries for domain "pyme" SHALL be returned
