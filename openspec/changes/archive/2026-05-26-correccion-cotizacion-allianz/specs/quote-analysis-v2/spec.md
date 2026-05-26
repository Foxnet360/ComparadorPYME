# Spec: Quote Analysis V2 (Delta)

## Delta for: quote-analysis-v2

## Changes

### MODIFIED Requirements

#### Requirement: Dynamic timeout based on coverage count
The fixed 2-minute timeout SHALL be replaced with a dynamic timeout.

##### Scenario: Timeout calculation
- **WHEN** a quote has N coverages
- **THEN** the timeout SHALL be: max(120, 30 + N × 3) seconds
- **AND** minimum timeout SHALL be 120 seconds (2 minutes)
- **AND** maximum timeout SHALL be 300 seconds (5 minutes)

##### Scenario: Small quote
- **WHEN** a quote has 5 coverages
- **THEN** timeout SHALL be 30 + 15 = 45 seconds
- **BUT** minimum applies: 120 seconds

##### Scenario: Large quote
- **WHEN** a quote has 50 coverages
- **THEN** timeout SHALL be 30 + 150 = 180 seconds (3 minutes)

##### Scenario: Very large quote
- **WHEN** a quote has 100 coverages
- **THEN** timeout SHALL be 30 + 300 = 330 seconds
- **BUT** maximum applies: 300 seconds (5 minutes)

#### Requirement: Graceful degradation on timeout
The system SHALL continue processing remaining quotes if one times out.

##### Scenario: One quote times out
- **WHEN** quote 2 of 3 times out
- **THEN** the system SHALL:
  1. Log the timeout error
  2. Mark quote 2 as "failed: timeout"
  3. Continue processing quote 3
  4. Include partial results in the final analysis
  5. Show a warning to the user: "Análisis incompleto: cotización X no pudo procesarse por timeout"

##### Scenario: All quotes process successfully
- **WHEN** all quotes complete within their timeouts
- **THEN** the system SHALL show full comparison as before

#### Requirement: Updated processing time target
The total processing time requirement SHALL account for large quotes.

##### Scenario: 3 quotes with 20 coverages each
- **WHEN** processing 3 large quotes
- **THEN** total time SHALL be < 15 minutes
- **AND** individual quote timeout SHALL be ~3 minutes each
- **AND** the system SHALL NOT fail the entire analysis

### ADDED Requirements

#### Requirement: Support for CONDITIONS format
The system SHALL support quotes in CONDITIONS format.

##### Scenario: Allianz quote analysis
- **WHEN** format family is CONDITIONS
- **THEN** the system SHALL use the CONDITIONS-specific prompt
- **AND** extract coverages from narrative text
- **AND** handle missing individual insured amounts
- **AND** look for deductibles in the conditions text

#### Requirement: Partial results handling
The system SHALL generate comparison even with partial results.

##### Scenario: One quote failed
- **WHEN** 2 of 3 quotes succeed
- **THEN** the system SHALL generate comparison for the 2 successful quotes
- **AND** mark the failed quote as "No disponible" in the comparison table
- **AND** include a note explaining the failure

## Dependencies
- `quote-extraction-conditions-format` for CONDITIONS format support
- `format-family-detection` for format classification
