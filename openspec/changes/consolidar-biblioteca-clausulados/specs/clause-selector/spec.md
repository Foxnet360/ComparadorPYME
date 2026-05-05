## ADDED Requirements

### Requirement: Select multiple clauses per insurer
The system SHALL allow users to select multiple clause documents from the same insurer when they represent different document types or products.

#### Scenario: Select general and particular clauses
- **WHEN** user is selecting clauses for analysis
- **AND** insurer "AXA" has both General and Particular clauses available
- **THEN** the user SHALL be able to select both
- **AND** both SHALL be included in the analysis

#### Scenario: Visual grouping by insurer
- **WHEN** displaying clause selection options
- **THEN** clauses SHALL be grouped by insurer
- **AND** each group SHALL be collapsible
- **AND** active clauses SHALL appear first within each group

### Requirement: Display version in selector
The system SHALL display version information in the clause selector.

#### Scenario: Show version for each clause
- **WHEN** displaying clause options
- **THEN** each option SHALL show: insurer, product name, document type, version
- **AND** indicate if it's the latest active version

## MODIFIED Requirements

### Requirement: Selector de clausulados en flujo de análisis
El sistema MUST proporcionar un selector de clausulados en el flujo de análisis de cotizaciones, permitiendo selección múltiple por aseguradora.

#### Scenario: Seleccionar clausulados pre-cargados
- **WHEN** el usuario sube cotizaciones para análisis
- **THEN** se MUST mostrar un selector agrupado por aseguradora
- **AND** el usuario SHALL poder seleccionar múltiples clausulados por aseguradora
- **AND** se MUST mostrar la versión de cada clausulado

### Requirement: Compatibilidad con flujo actual
El sistema MUST mantener compatibilidad con el flujo tradicional de upload de clausulados, y también permitir selección desde biblioteca con múltiples versiones.

#### Scenario: Upload tradicional de clausulados
- **WHEN** el usuario prefiere subir clausulados manualmente
- **THEN** el sistema MUST permitir upload como antes
- **AND** SHOULD ofrecer opción de guardar en biblioteca con versión
