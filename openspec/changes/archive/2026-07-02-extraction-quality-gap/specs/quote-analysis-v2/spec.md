# Delta for quote-analysis-v2

## MODIFIED Requirements

### Requirement: Text-based quote analysis

The system SHALL analyze insurance quotes using multimodal PDF extraction followed by post-normalization when invoked as the fallback path by the comparison engine adapter.

(Previously: this was the default analysis path for all quote requests.)

#### Scenario: Single quote fallback

- GIVEN the unified engine failed for a request with one quote
- WHEN the adapter invokes the per-quote pipeline
- THEN the system SHALL process the quote sequentially
- AND it SHALL normalize coverages to canonical categories
- AND it SHALL return structured quote data with 14 canonical coverages

#### Scenario: Multiple quote fallback

- GIVEN the unified engine failed for a request with 3-5 quotes
- WHEN the adapter invokes the per-quote pipeline
- THEN the system SHALL process each quote sequentially
- AND it SHALL combine results into a comparative analysis
- AND total processing time SHALL be < 15 minutes

#### Scenario: Timeout with cancellation

- GIVEN a quote extraction exceeds its dynamic timeout
- WHEN the adapter is running the fallback path
- THEN the Gemini request SHALL be cancelled via AbortController
- AND the system SHALL mark the quote as failed
- AND it SHALL continue processing remaining quotes

### Requirement: Unified engine integration

The system SHALL expose the per-quote pipeline as a fallback service for the comparison engine adapter and SHALL NOT check `USE_UNIFIED_ENGINE` internally.

(Previously: the pipeline checked the feature flag and routed to the unified engine itself.)

#### Scenario: Adapter-driven fallback

- GIVEN the adapter decides to fallback from the unified engine
- WHEN it calls the per-quote pipeline
- THEN the pipeline SHALL process the quotes
- AND it SHALL return individual `QuoteAnalysis` objects
- AND the adapter SHALL transform them to `MatrixRow[]`

#### Scenario: No internal flag check

- GIVEN a request reaches the per-quote pipeline
- WHEN it starts processing
- THEN it SHALL NOT read `USE_UNIFIED_ENGINE`
- AND it SHALL NOT route to the unified engine
