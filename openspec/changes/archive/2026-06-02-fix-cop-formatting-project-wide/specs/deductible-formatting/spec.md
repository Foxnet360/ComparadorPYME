## MODIFIED Requirements

### Requirement: Deductible percentages display with Colombian format
Deductible percentages displayed in ANY deductible component SHALL use comma as the decimal separator according to Colombian standards.

#### Scenario: Whole number percentage
- **WHEN** a deductible percentage is "10"
- **THEN** it displays as "10%"

#### Scenario: Decimal percentage
- **WHEN** a deductible percentage is "12.5"
- **THEN** it displays as "12,5%"

#### Scenario: Deductible minimum amount
- **WHEN** a deductible has a minimum monetary amount
- **THEN** the amount is formatted with `formatCOP` using Colombian separators

#### Scenario: Variable comparison deductible display
- **WHEN** displaying deductibles in VariableComparisonMatrix
- **THEN** percentage values use comma as decimal separator and monetary values use `formatCOP`

### Requirement: Deductible severity indicators remain functional
The severity color coding (good/warning/critical) for deductibles SHALL continue to work correctly after formatting changes.

#### Scenario: High deductible with formatting
- **WHEN** a deductible is "20%" (high severity)
- **THEN** it displays as "20%" with amber warning styling
