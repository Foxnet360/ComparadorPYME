# Spec: Quote Analysis V2 (Delta)

## Delta for: quote-analysis-v2

## MODIFIED Requirements

### Requirement: Text-based quote analysis
The system SHALL analyze insurance quotes using **multimodal PDF extraction** followed by post-normalization, instead of text-based extraction with deterministic parsing. **MODIFIED**: When the `USE_UNIFIED_ENGINE` feature flag is enabled, the system SHALL use the unified comparison engine to process all quotes in a single call instead of processing them individually.

#### Scenario: Single quote analysis (legacy mode)
- **WHEN** a user uploads a quote PDF and `USE_UNIFIED_ENGINE` is disabled
- **THEN** the system SHALL process using the existing pipeline:
  1. Detect format family
  2. Upload PDF to Gemini File API
  3. Extract structured data with specialized prompt
  4. Normalize coverages to canonical categories
  5. Return structured quote data with 14 canonical coverages

#### Scenario: Multiple quotes with unified engine
- **WHEN** a user uploads 3-5 quote PDFs and `USE_UNIFIED_ENGINE` is enabled
- **THEN** the system SHALL route to the unified comparison engine
- **AND** it SHALL process all quotes in a single Gemini call
- **AND** it SHALL return a `UnifiedComparisonResult` instead of individual `QuoteAnalysis` objects
- **AND** the adapter SHALL transform the result to `MatrixRow[]` for compatibility

#### Scenario: Unified engine fallback
- **WHEN** the unified engine fails during processing
- **THEN** the adapter SHALL automatically fallback to individual extraction
- **AND** it SHALL process each quote sequentially as before
- **AND** it SHALL log the fallback event

## ADDED Requirements

### Requirement: Unified engine integration
The system SHALL support the unified comparison engine as an alternative processing path.

#### Scenario: Feature flag routing
- **WHEN** the comparison endpoint receives a request
- **THEN** it SHALL check the `USE_UNIFIED_ENGINE` feature flag
- **AND** if enabled, route to `unifiedComparisonEngine.compare()`
- **AND** if disabled, use the existing `quoteAnalysisService.analyze()`

#### Scenario: Result format compatibility
- **WHEN** using the unified engine
- **THEN** the final output SHALL be compatible with the existing comparison view
- **AND** it SHALL produce the same `MatrixRow[]` structure
- **AND** the Excel export SHALL generate identical format

## Dependencies
- `unified-comparison-extraction` for unified engine processing
- `comparison-engine-adapter` for feature flag routing and fallback
