## ADDED Requirements

### Requirement: Integración en dashboard existente
El sistema DEBE mostrar métricas reales de riesgo en el dashboard de auditoría en vez de placeholders.

#### Scenario: Métricas reales de validación
- **WHEN** el usuario visualiza el dashboard de auditoría
- **AND** existen datos de validación de coberturas
- **THEN** se muestran métricas reales:
  - Coberturas verificadas (conteo real)
  - Coberturas fantasma (conteo real)
  - Coberturas obligatorias omitidas (conteo real)

#### Scenario: Métricas reales de deducibles
- **WHEN** el usuario visualiza el dashboard de auditoría
- **AND** existen datos de análisis de deducibles
- **THEN** se muestran métricas reales:
  - Deducibles de riesgo bajo (conteo real)
  - Deducibles de riesgo medio (conteo real)
  - Deducibles de riesgo alto (conteo real)

#### Scenario: Placeholders cuando no hay datos
- **WHEN** el usuario visualiza el dashboard de auditoría
- **AND** no existen datos de análisis avanzado
- **THEN** se mantienen los placeholders "-" actuales
- **AND** se muestra tooltip informativo: "Disponible con análisis avanzado"

### Requirement: Dashboard responsivo a datos
El sistema DEBE adaptar el dashboard según la disponibilidad de datos.

#### Scenario: Dashboard completo
- **WHEN** existen todos los tipos de datos (validación, deducibles, contextual)
- **THEN** se muestra el dashboard completo con todas las secciones

#### Scenario: Dashboard parcial
- **WHEN** solo existen algunos tipos de datos
- **THEN** se muestran las secciones correspondientes
- **AND** las secciones sin datos se colapsan o muestran mensaje informativo

## MODIFIED Requirements

### Requirement: Dashboard de auditoría
El sistema DEBE proporcionar un dashboard de auditoría que muestre métricas de análisis.

#### Scenario: Dashboard con métricas de análisis avanzado
- **WHEN** el usuario accede a la pestaña de auditoría
- **AND** se ha realizado análisis avanzado
- **THEN** el dashboard muestra:
  - Alertas críticas/advertencias/destacados (existente)
  - Riesgos cruzados entre aseguradoras (existente)
  - Métricas de validación de coberturas (nuevo)
  - Métricas de riesgo de deducibles (nuevo)
  - Contexto de negocio (existente, enriquecido si hay perfil)

### Requirement: Indicadores de severidad
El sistema DEBE mostrar indicadores visuales de la severidad de los hallazgos.

#### Scenario: Indicadores con datos reales
- **WHEN** se detectan coberturas fantasma
- **THEN** el indicador de críticos se incrementa
- **AND** se muestra en rojo con conteo real
- **AND** al hacer click, muestra detalle de las coberturas fantasma
