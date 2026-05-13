## ADDED Requirements

### Requirement: Structured deductible comparison matrix
The system SHALL display a dedicated matrix showing deductibles side-by-side for all insurers and coverages.

#### Scenario: Complete deductible matrix
- **WHEN** the user navigates to the "Deducibles" tab
- **THEN** a matrix is shown with rows = 14 canonical coverages, columns = insurers
- **AND** each cell shows: Sum Insured | Deductible | Sublimit (if any)
- **AND** cells are color-coded: green (low risk), yellow (medium), red (high/no deductible)

#### Scenario: Deductible risk indicators
- **WHEN** a deductible is > 10% or unspecified
- **THEN** the cell background is red with tooltip explaining the risk
- **AND** show comparison to market average if available

#### Scenario: Missing coverage handling
- **WHEN** an insurer doesn't offer a coverage
- **THEN** the cell shows "No incluida" in gray
- **AND** does not affect the deductible risk calculation

### Requirement: Sublimit display
The system SHALL extract and display sublimits alongside deductibles.

#### Scenario: Sublimit detection
- **WHEN** a coverage text mentions "Hasta", "Máximo", "Sublímite", "por evento"
- **THEN** the system SHALL extract the sublimit value
- **AND** display it in the matrix as "Sub: $X por evento"

#### Scenario: Sublimit vs insured amount comparison
- **WHEN** a sublimit is significantly lower than the insured amount
- **THEN** flag as WARNING: "Sublímite bajo relativo a suma asegurada"

### Requirement: Deductible analysis summary
The system SHALL provide a summary analysis of deductible patterns across insurers.

#### Scenario: Best/worst deductible summary
- **WHEN** the deductible matrix is displayed
- **THEN** a summary panel shows: "Mejor deducible: [Insurer]" and "Peor deducible: [Insurer]"
- **AND** lists coverages where deductibles differ significantly (>5%)

#### Scenario: Negotiation recommendations
- **WHEN** an insurer has deductibles consistently higher than market
- **THEN** the system SHALL suggest negotiation points
- **AND** reference specific coverages where improvement is possible
