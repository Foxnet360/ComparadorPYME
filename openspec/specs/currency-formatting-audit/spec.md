## ADDED Requirements

### Requirement: Systematic audit of currency formatting
The system SHALL include a process to identify and fix all monetary values displayed without proper Colombian formatting across the frontend codebase.

#### Scenario: Finding unformatted values
- **WHEN** auditing the codebase for currency display
- **THEN** all monetary values in components use the centralized `formatCOP` utility

#### Scenario: No inline formatting
- **WHEN** a developer adds a new monetary display
- **THEN** they use `formatCOP` instead of inline `toLocaleString()` or string concatenation

### Requirement: Centralized formatting enforcement
All monetary values displayed to users SHALL use the centralized `formatCOP` utility from `utils/formatCurrency.ts`.

#### Scenario: Coverage matrix display
- **WHEN** displaying coverage values in any matrix component
- **THEN** values use `formatCOP` with Colombian separators

#### Scenario: Price display
- **WHEN** displaying prices or premiums in any component
- **THEN** values use `formatCOP` with Colombian separators

#### Scenario: Deductible amount display
- **WHEN** displaying deductible monetary amounts
- **THEN** values use `formatCOP` or `formatNumber` with Colombian separators

### Requirement: Special values handling
Special non-monetary values SHALL display as text without currency formatting.

#### Scenario: Excluded coverage
- **WHEN** a coverage is marked as excluded
- **THEN** it displays "EXCLUIDO" without currency formatting

#### Scenario: No value specified
- **WHEN** a monetary field has no value
- **THEN** it displays "NO ESPECIFICADO" without currency formatting

#### Scenario: Not applicable
- **WHEN** a field is not applicable
- **THEN** it displays "NO APLICA" without currency formatting
