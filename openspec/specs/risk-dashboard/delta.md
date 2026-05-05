## Delta Spec

### Requirement: Métricas de validación de coberturas

El dashboard DEBE mostrar métricas de coberturas fantasma y verificadas.

#### Scenario: Métricas de validación
- **WHEN** se carga la pestaña de Auditoría
- **THEN** se muestran contadores:
  - Coberturas verificadas: 12
  - Coberturas fantasma: 1
  - Coberturas obligatorias omitidas: 0

### Requirement: Métricas de riesgo de deducibles

El dashboard DEBE mostrar el riesgo agregado de deducibles.

#### Scenario: Riesgo de deducibles
- **WHEN** hay múltiples aseguradoras
- **THEN** se muestra indicador:
  - Aseguradoras con deducibles de riesgo alto: 1
  - Aseguradoras con deducibles de riesgo medio: 2
  - Aseguradoras con deducibles de riesgo bajo: 1

### Requirement: Matriz de condiciones de cumplimiento

El dashboard DEBE mostrar el estado de cumplimiento de garantías.

#### Scenario: Dashboard de garantías
- **WHEN** se visualiza la auditoría técnica
- **THEN** se muestra tabla:
  - Aseguradora × Tipo de condición (Documental, Operacional, Técnica, Financiera)
  - Celdas con % de cumplimiento
  - Rojo: < 50%, Amarillo: 50-80%, Verde: > 80%
