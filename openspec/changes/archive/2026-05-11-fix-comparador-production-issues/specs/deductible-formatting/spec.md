## ADDED Requirements

### Requirement: Parsing de deducibles con formato complejo
El sistema DEBE parsear correctamente formatos de deducibles reales de aseguradoras colombianas que incluyen combinaciones de porcentaje, mínimo en SMMLV, y variaciones de espaciado.

#### Scenario: Deductible con espacio antes del porcentaje
- **WHEN** el deducible es "10 % PERD Min 1 (SMMLV)"
- **THEN** se extrae el porcentaje "10%"
- **AND** se extrae el mínimo "1 SMMLV"
- **AND** se muestra como "10% PERD Min 1 SMMLV"

#### Scenario: Deductible sin espacio
- **WHEN** el deducible es "10% PERD Min 1 SMMLV"
- **THEN** se extrae el porcentaje "10%"
- **AND** se extrae el mínimo "1 SMMLV"
- **AND** se muestra como "10% PERD Min 1 SMMLV"

#### Scenario: Sin deducible explícito
- **WHEN** el deducible es "Sin deducible"
- **THEN** se almacena como `null` (no como "0" ni cadena vacía)
- **AND** en la UI se muestra "Sin deducible"

#### Scenario: Deductible con múltiples componentes
- **WHEN** el deducible es "15% PERD Min 2 SMMLV Max 50 SMMLV"
- **THEN** se extrae el porcentaje "15%"
- **AND** se extrae el mínimo "2 SMMLV"
- **AND** se extrae el máximo "50 SMMLV"
- **AND** se muestra el formato completo preservado

## MODIFIED Requirements

### Requirement: Deductible percentages display with Colombian format
Deductible percentages displayed in the DeductiblesComparisonTable SHALL use comma as the decimal separator according to Colombian standards.

#### Scenario: Whole number percentage
- **WHEN** a deductible percentage is "10"
- **THEN** it displays as "10%"

#### Scenario: Decimal percentage
- **WHEN** a deductible percentage is "12.5"
- **THEN** it displays as "12,5%"

#### Scenario: Deductible minimum amount
- **WHEN** a deductible has a minimum of "5 SMMLV"
- **THEN** the number "5" is formatted with Colombian separators if applicable

### Requirement: Deductible severity indicators remain functional
The severity color coding (good/warning/critical) for deductibles SHALL continue to work correctly after formatting changes.

#### Scenario: High deductible with formatting
- **WHEN** a deductible is "20%" (high severity)
- **THEN** it displays as "20%" with amber warning styling
