# Spec: Rule-Based Scoring

## Capability
Sistema de scoring determinístico basado en reglas de negocio para evaluar cotizaciones de seguros, sin depender de LLM.

## User Story
**Como** usuario del comparador
**Quiero** ver un score numérico para cada cotización
**Para** compararlas objetivamente

## Functional Requirements

### FR-1: Deterministic scoring calculation
The system SHALL calculate quote scores using deterministic business rules, not LLM inference.

#### Scenario: Coverage completeness scoring
- **WHEN** a quote includes 10 out of 14 standard PYME coverages
- **THEN** the coverage dimension scores 7.1 (10/14 * 10)
- **AND** missing coverages are listed in the analysis

#### Scenario: Deductible favorability
- **WHEN** a quote has deductibles averaging 3% across all coverages
- **THEN** the deductibles dimension scores 8.0
- **AND** the scoring formula penalizes high deductibles proportionally

#### Scenario: Price ratio calculation
- **WHEN** a quote's price is compared to the average of all quotes
- **THEN** the priceRatio dimension scores higher for better value
- **AND** the calculation uses: (avg_price / quote_price) * 10, capped at 10

### FR-2: Configurable scoring weights
The system SHALL support configurable weights for each scoring dimension.

#### Scenario: Default weights
- **WHEN** no custom weights are provided
- **THEN** the system uses default weights: coverage 25%, deductibles 20%, exclusions 20%, priceRatio 15%, sublimits 10%, warranties 10%

#### Scenario: Custom weights
- **WHEN** a client specifies different weights via configuration
- **THEN** the system applies those weights in the scoring formula
- **AND** returns both raw scores and weighted final score

### FR-3: Score range validation
The system SHALL ensure all scores are integers between 0 and 100.

#### Scenario: Valid score calculation
- **WHEN** dimension scores are [8, 7, 9, 6, 8, 7]
- **THEN** the final score is calculated as: (8*0.25 + 7*0.20 + 9*0.20 + 6*0.15 + 8*0.10 + 7*0.10) * 10 = 75
- **AND** the result is rounded to nearest integer

#### Scenario: Edge case handling
- **WHEN** a quote has no data for a dimension
- **THEN** that dimension scores 0
- **AND** the final score is calculated with remaining dimensions

## Scoring Dimensions
| Dimensión | Peso Default | Descripción |
|-----------|-------------|-------------|
| coverage | 25% | Completitud de coberturas (n/14 * 10) |
| deductibles | 20% | Favorabilidad de deducibles |
| exclusions | 20% | Riesgo de exclusiones |
| priceRatio | 15% | Relación precio vs promedio |
| sublimits | 10% | Impacto de sublímites |
| warranties | 10% | Facilidad de garantías |

## Dependencies
- Datos de cotizaciones parseadas (Deterministic Quote Parser)
- Datos de cláusulas (opcional, para exclusion scoring)
