## MODIFIED Requirements

### Requirement: Validate extracted values against source text
The system SHALL verify that extracted coverage values exist in the raw source text before accepting them as factual. **ADDED**: The system SHALL also validate that parsed monetary values preserve decimal points in abbreviations.

#### Scenario: Decimal abbreviation preserved
- **WHEN** the raw text contains "1.5M" (1,500,000)
- **THEN** `parseCoverageValue` SHALL return 1,500,000
- **AND** SHALL NOT return 15,000,000

#### Scenario: Thousand separator handled
- **WHEN** the raw text contains "1.500.000" (Colombian format)
- **THEN** `parseCoverageValue` SHALL return 1,500,000
- **AND** SHALL correctly distinguish from decimal abbreviations

#### Scenario: Currency normalization
- **WHEN** a value is in USD (e.g., "$1,000")
- **AND** the analysis is in COP
- **THEN** the system SHALL normalize to COP before range validation
- **OR** SHALL skip range validation if currency conversion is unavailable

## ADDED Requirements

### Requirement: Externalize SMMLV/UVT Values
The system SHALL use configurable SMMLV and UVT values instead of hardcoded ones.

#### Scenario: Configurable values
- **WHEN** SMMLV changes (e.g., from 1,300,000 to 1,423,500)
- **THEN** updating the environment variable `SMMLV_VALUE` SHALL update all calculations
- **AND** no code changes SHALL be required

#### Scenario: Fallback values
- **WHEN** SMMLV_VALUE is not set
- **THEN** the system SHALL use a sensible default
- **AND** log a warning: "SMMLV_VALUE not set, using default: X"

### Requirement: Precise Financial Calculations
The system SHALL use decimal arithmetic for all monetary calculations.

#### Scenario: Price scoring precision
- **WHEN** calculating price scores with large values (billions of COP)
- **THEN** `decimal.js` SHALL be used
- **AND** floating point errors SHALL NOT occur

#### Scenario: Sum of prices
- **WHEN** summing multiple quote prices
- **THEN** the sum SHALL be exact
- **AND** SHALL NOT accumulate rounding errors
