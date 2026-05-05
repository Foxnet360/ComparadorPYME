## ADDED Requirements

### Requirement: Executive Summary
El sistema DEBE mostrar un resumen ejecutivo al inicio del reporte.

#### Scenario: Insights clave
- **WHEN** se carga el tab Resumen
- **THEN** muestra: Mejor opción, Mayor riesgo, Ahorro potencial

#### Scenario: Action buttons
- **WHEN** el resumen está visible
- **THEN** botones rápidos: [Ver Matriz] [Ver Deducibles] [Ver Riesgos]

### Requirement: Severity bars
El sistema DEBE mostrar barras visuales de severidad para deducibles.

#### Scenario: Barra de severidad
- **WHEN** se muestra un deducible
- **THEN** mostrar barra horizontal con color según severidad
- **AND** tooltip con detalles técnicos
