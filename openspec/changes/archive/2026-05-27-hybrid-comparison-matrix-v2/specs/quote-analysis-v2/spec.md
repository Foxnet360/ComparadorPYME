# Spec: Quote Analysis V2 (Delta)

## Delta for: quote-analysis-v2

## MODIFIED Requirements

### Requirement: Text-based quote analysis
The system SHALL analyze insurance quotes using **multimodal PDF extraction** followed by post-normalization, instead of text-based extraction with deterministic parsing. **MODIFIED**: The extraction pipeline SHALL capture detailed narrative breakdowns of inclusions, sub-limits, and exclusions in a dedicated `details` property for each coverage to feed the row-grouped grid visualizer, in addition to sums and deductibles.

#### Scenario: Single quote analysis with details extraction
- **WHEN** a user uploads a quote PDF
- **THEN** the system SHALL:
  1. Detect format family (format-family-detection)
  2. Upload PDF to Gemini File API (multimodal-pdf-extraction)
  3. Extract structured data including detailed breakdowns of coverage inclusions and sub-limits in `details` fields
  4. Normalize coverages to canonical categories (coverage-post-normalization)
  5. Return structured quote data with 14 canonical coverages enriched with `details` strings

#### Scenario: Parallel processing with synchronization
- **WHEN** multiple quotes are processed
- **THEN** the system SHALL use `Promise.all` with proper result mapping
- **AND** SHALL NOT use array index assignment in async batches
- **AND** results SHALL maintain correct order

#### Scenario: Timeout with cancellation
- **WHEN** a quote extraction exceeds the timeout
- **THEN** the underlying Gemini request SHALL be cancelled via AbortController
- **AND** resources SHALL be freed

#### Scenario: Idempotent analysis history
- **WHEN** an analysis is saved to history
- **THEN** an idempotency key SHALL prevent duplicate entries
- **AND** retrying the same analysis SHALL NOT create duplicates
