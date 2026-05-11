## ADDED Requirements

### Requirement: Integración en reporte comparativo
El sistema DEBE soportar una nueva pestaña "Análisis Avanzado" en el reporte comparativo.

#### Scenario: Pestaña visible cuando hay datos avanzados
- **WHEN** el usuario visualiza el reporte comparativo
- **AND** existen datos de análisis avanzado (clauseValidation, deductibleAnalysis, etc.)
- **THEN** se muestra la pestaña "Análisis Avanzado" junto a las pestañas existentes

#### Scenario: Pestaña oculta cuando no hay datos
- **WHEN** el usuario visualiza el reporte comparativo
- **AND** no existen datos de análisis avanzado
- **THEN** la pestaña "Análisis Avanzado" no se muestra

### Requirement: Renderizado condicional de componentes
El sistema DEBE renderizar componentes de análisis avanzado solo cuando existan datos correspondientes.

#### Scenario: Componentes renderizados condicionalmente
- **WHEN** el usuario está en la pestaña "Análisis Avanzado"
- **AND** existen datos de clauseValidation
- **THEN** se renderiza CoverageValidationMatrix
- **AND** si existen datos de deductibleAnalysis, se renderiza DeductibleRiskGauge
- **AND** así sucesivamente para cada componente

#### Scenario: Mensaje cuando no hay datos específicos
- **WHEN** el usuario está en la pestaña "Análisis Avanzado"
- **AND** no existe un tipo de análisis específico
- **THEN** se muestra mensaje informativo: "Análisis no disponible para esta cotización"

## MODIFIED Requirements

### Requirement: Reporte comparativo de cotizaciones
El sistema DEBE generar un reporte comparativo que permita evaluar múltiples cotizaciones de seguros PYME.

#### Scenario: Reporte con análisis avanzado
- **WHEN** el sistema genera el reporte comparativo
- **AND** se ha realizado análisis avanzado
- **THEN** el reporte incluye:
  - Datos básicos de cotizaciones (existente)
  - Scoring multidimensional (existente)
  - Alertas de validación (nuevo)
  - Métricas de validación de clausulados (nuevo)
  - Referencias a análisis detallado en pestaña avanzada (nuevo)

### Requirement: Navegación por pestañas en reporte
El sistema DEBE permitir navegar entre diferentes vistas del análisis mediante pestañas.

#### Scenario: Navegación completa
- **WHEN** el usuario visualiza el reporte comparativo
- **THEN** puede navegar entre:
  - Resumen (existente)
  - Coberturas (existente)
  - Deducibles (existente)
  - Auditoría (existente)
  - Análisis Avanzado (nuevo, condicional)
