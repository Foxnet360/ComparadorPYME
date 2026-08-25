## ADDED Requirements

### Requirement: Adaptación de la interfaz del reporte según el ramo auditado
El sistema DEBE adaptar dinámicamente los encabezados, agrupaciones de coberturas y etiquetas de métricas en `ComparisonReport` según el ramo del reporte (`pyme` o `autos`).

#### Scenario: Visualización de reporte de cotizaciones para el ramo Autos
- **WHEN** se renderiza un reporte cuya propiedad `domain` sea `autos`
- **THEN** el componente `ComparisonReport` y sus matrices hijas utilizan la terminología y secciones contextuales del ramo automotor.
