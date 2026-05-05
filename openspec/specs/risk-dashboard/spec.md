## ADDED Requirements

### Requirement: Dashboard ejecutivo de riesgos
El sistema DEBE mostrar un dashboard superior con métricas agregadas de riesgos.

#### Scenario: Resumen por severidad
- **WHEN** se carga la pestaña de Auditoría
- **THEN** se muestran contadores: Críticos (3), Advertencias (8), Destacados (5)

#### Scenario: Gráfico de riesgos por aseguradora
- **WHEN** hay múltiples aseguradoras
- **THEN** se muestra stacked bar chart con CRITICAL/WARNING/GOOD por aseguradora

### Requirement: Comparativa cruzada de riesgos
El sistema DEBE mostrar matriz de qué riesgos afectan a qué aseguradoras.

#### Scenario: Matriz cruzada
- **WHEN** se visualiza la auditoría
- **THEN** se muestra tabla: Riesgo × Aseguradora
- **AND** se indica con ✓ si la aseguradora tiene ese riesgo

### Requirement: Análisis contextual
El sistema DEBE proporcionar contexto según la naturaleza del negocio.

#### Scenario: Contexto de industria
- **WHEN** el negocio es manufactura
- **THEN** se explica el impacto típico del riesgo en manufactura
- **AND** se sugiere mitigación específica
