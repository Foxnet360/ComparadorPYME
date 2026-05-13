# Spec: Deductible Matrix

## Capability
Structured deductible comparison matrix showing 14 canonical coverages × N insurers with sum insured, deductible, and sublimit columns.

## User Story
**Como** corredor de seguros
**Quiero** comparar deducibles lado a lado para todas las aseguradoras
**Para** identificar rápidamente las mejores y peores condiciones

## Functional Requirements

### FR-1: Structured deductible comparison matrix
The system SHALL display a dedicated matrix showing deductibles side-by-side for all insurers and coverages.

#### Scenario: Complete deductible matrix
- **WHEN** the user navigates to the "Deducibles" tab
- **THEN** a matrix is shown with rows = 14 canonical coverages, columns = insurers
- **AND** each cell shows: Sum Insured | Deductible | Sublimit (if any)
- **AND** cells are color-coded: green (low risk), yellow (medium), red (high/no deductible)
- **AND** value source indicators (🧮 calculated, 💡 inferred) are displayed when applicable

#### Scenario: Deductible risk indicators
- **WHEN** a deductible is > 10% or unspecified
- **THEN** the cell background is red with tooltip explaining the risk
- **AND** show comparison to market average if available
- **AND** display effective deductible vs nominal deductible when cap is applied

#### Scenario: Missing coverage handling
- **WHEN** an insurer doesn't offer a coverage
- **THEN** the cell shows "No incluida" in gray
- **AND** does not affect the deductible risk calculation

#### Scenario: Sublimit display in deductible context
- **WHEN** a coverage has sublimits (per_event, per_item, aggregate)
- **THEN** display the sublimit below the deductible with appropriate icon
- **AND** if sublimit affects deductible calculation, show effective deductible

### FR-2: Deductible analysis summary
The system SHALL provide a summary analysis of deductible patterns across insurers.

#### Scenario: Best/worst deductible summary
- **WHEN** the deductible matrix is displayed
- **THEN** a summary panel shows: "Mejor deducible: [Insurer]" and "Peor deducible: [Insurer]"
- **AND** lists coverages where deductibles differ significantly (>5%)

#### Scenario: Negotiation recommendations
- **WHEN** an insurer has deductibles consistently higher than market
- **THEN** the system SHALL suggest negotiation points
- **AND** reference specific coverages where improvement is possible
- **AND** link to "Puntos de Negociación" section in audit dashboard

### FR-3: Cap and sublimit integration
The system SHALL integrate cap and sublimit analysis from `deductible-risk-analysis` into the matrix view.

#### Scenario: Cap applied indicator
- **WHEN** a deductible has a cap that is applied (effective < nominal)
- **THEN** show savings amount: "Ahorro: $X vs deducible nominal"
- **AND** display cap badge with green color

#### Scenario: Aggregate limit warning
- **WHEN** aggregate limits are detected for the coverage
- **THEN** show warning badge in the matrix cell
- **AND** link to detailed analysis in audit section

## Dependencies
- Deductible risk analysis service
- Coverage data with deductible and sublimit fields
- Color coding utilities