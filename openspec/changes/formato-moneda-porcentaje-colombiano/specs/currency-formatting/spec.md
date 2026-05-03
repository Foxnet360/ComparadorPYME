## ADDED Requirements

### Requirement: Formato de moneda COP estándar
El sistema DEBE formatear valores monetarios en COP usando separador de miles con punto (.) y separador decimal con coma (,) según el estándar colombiano.

#### Scenario: Formato de miles
- **WHEN** se formatea el valor 1234
- **THEN** el resultado debe ser "$1.234"

#### Scenario: Formato de cientos de miles
- **WHEN** se formatea el valor 123456
- **THEN** el resultado debe ser "$123.456"

#### Scenario: Formato de millones
- **WHEN** se formatea el valor 1234567
- **THEN** el resultado debe ser "$1.234.567"

#### Scenario: Formato de miles de millones
- **WHEN** se formatea el valor 1234567890
- **THEN** el resultado debe ser "$1.234.567.890"

#### Scenario: Formato con decimales
- **WHEN** se formatea el valor 1234.56 con 2 decimales
- **THEN** el resultado debe ser "$1.234,56"

#### Scenario: Formato sin símbolo
- **WHEN** se formatea el valor 1234 con showSymbol=false
- **THEN** el resultado debe ser "1.234"
