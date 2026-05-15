## MODIFIED Requirements

### Requirement: Deterministic scoring calculation
The system SHALL calculate quote scores using deterministic business rules, not LLM inference.

#### Scenario: Coverage completeness scoring
- **WHEN** a quote includes 10 out of 14 standard PYME coverages
- **THEN** the coverage dimension scores 71 (10/14 * 100)
- **AND** missing coverages are listed in the analysis
- **AND** the score is NOT penalized for lack of clause verification

#### Scenario: Deductible favorability
- **WHEN** a quote has deductibles averaging 3% across all coverages
- **THEN** the deductibles dimension scores 80
- **AND** the scoring formula penalizes high deductibles proportionally
- **AND** if no clause data is available, score is based on quote data alone

#### Scenario: Price ratio calculation
- **WHEN** a quote's price is compared to the average of all quotes
- **THEN** the priceRatio dimension scores higher for better value
- **AND** the calculation uses: (avg_price / quote_price) * 100, capped at 100

### Requirement: Configurable scoring weights
The system SHALL support configurable weights for each scoring dimension.

#### Scenario: Default weights
- **WHEN** no custom weights are provided
- **THEN** the system uses default weights: coverage 25%, deductibles 20%, exclusions 15%, priceRatio 20%, sublimits 10%, warranties 10%
- **AND** if RAG data is unavailable, exclusions and warranties use quote-only assessment

#### Scenario: Custom weights
- **WHEN** a client specifies different weights via configuration
- **THEN** the system applies those weights in the scoring formula
- **AND** returns both raw scores and weighted final score

### Requirement: Score range validation
The system SHALL ensure all scores are integers between 0 and 100.

#### Scenario: Valid score calculation
- **WHEN** dimension scores are [80, 70, 90, 60, 80, 70]
- **THEN** the final score is calculated as: (80*0.25 + 70*0.20 + 90*0.15 + 60*0.20 + 80*0.10 + 70*0.10) = 75
- **AND** the result is rounded to nearest integer

#### Scenario: Edge case handling
- **WHEN** a quote has no data for a dimension
- **THEN** that dimension scores based on available data or neutral default (50)
- **AND** the final score is calculated with adjusted weights

## ADDED Requirements

### Requirement: Separate data quality score from verification confidence
The system SHALL calculate and display two distinct metrics: Data Quality Score and Verification Confidence.

#### Scenario: Quote with good data but no RAG
- **WHEN** a quote has 12/14 coverages, competitive price, and reasonable deductibles
- **AND** no clause documents are available for verification
- **THEN** Data Quality Score = 85/100 (based on coverage, price, deductibles)
- **AND** Verification Confidence = 30/100 (low because unverified)
- **AND** both scores are displayed separately in the UI

#### Scenario: Quote with RAG verification
- **WHEN** a quote has clause documents available and cross-reference succeeds
- **THEN** Data Quality Score reflects coverage quality
- **AND** Verification Confidence reflects verification completeness (up to 100)

### Requirement: No-RAG scoring mode
The system SHALL calculate fair scores when RAG/clause data is unavailable.

#### Scenario: No clause documents
- **WHEN** no clause_chunks exist for any insurer in the analysis
- **THEN** the system uses quote-only scoring mode
- **AND** exclusions score is based on special conditions text analysis
- **AND** warranties score is based on coverage count and special conditions
- **AND** sublimits score uses neutral default (60) with info message

#### Scenario: Partial RAG availability
- **WHEN** some insurers have clauses and others don't
- **THEN** each insurer is scored based on available data
- **AND** scores are comparable across insurers

## Scoring Dimensions
| Dimensión | Peso Default | Descripción |
|-----------|-------------|-------------|
| coverage | 25% | Completitud de coberturas (n/14 * 100) |
| deductibles | 20% | Favorabilidad de deducibles |
| exclusions | 15% | Riesgo de exclusiones (RAG) o condiciones especiales (sin RAG) |
| priceRatio | 20% | Relación precio vs promedio |
| sublimits | 10% | Impacto de sublímites (RAG) o neutral (sin RAG) |
| warranties | 10% | Facilidad de garantías (RAG) o condiciones (sin RAG) |
