## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Separación de valor y deducible durante extracción
El sistema DEBE separar explícitamente el campo `value` (monto asegurado) del campo `deductible` (cuota de participación) durante la extracción de cotizaciones para evitar corrupción de datos.

#### Scenario: Valor y deducible separados
- **WHEN** la cotización muestra "RC: $300.000.000" y deducible "10% PERD Min 1 SMMLV"
- **THEN** el sistema extrae `value: 300000000`
- **AND** extrae `deductible: "10% PERD Min 1 SMMLV"`
- **AND** NO mezcla ambos campos

#### Scenario: Valor sospechoso detectado
- **WHEN** el valor extraído para RC es menor a $100.000.000
- **THEN** el sistema marca el valor como sospechoso
- **AND** registra una alerta en el log de extracción

#### Scenario: Deductible como valor
- **WHEN** el sistema detecta que un deducible fue extraído como valor asegurado
- **THEN** corrige la asignación intercambiando los campos
- **AND** marca la extracción para revisión manual
