## ADDED Requirements

### Requirement: Coverage values display with Colombian currency format
All monetary coverage values displayed in the UnifiedCoverageMatrix and uncategorized coverages sections SHALL use the Colombian currency format with dot as thousands separator and comma as decimal separator.

#### Scenario: Coverage value in millions
- **WHEN** a coverage has a value of "500000000"
- **THEN** it displays as "$500.000.000"

#### Scenario: Coverage value with decimals
- **WHEN** a coverage has a value of "1234567.89"
- **THEN** it displays as "$1.234.567,89"

#### Scenario: Excluded coverage
- **WHEN** a coverage is marked as excluded
- **THEN** it displays "EXCLUIDO" without currency formatting

#### Scenario: No coverage value
- **WHEN** a coverage has no value specified
- **THEN** it displays "NO ESPECIFICADO"
