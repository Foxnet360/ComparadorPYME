## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir el análisis de riesgo de deducibles en la respuesta del endpoint `/api/analyze`.

#### Scenario: Análisis de deducibles incluido en respuesta
- **WHEN** el sistema completa el análisis de una cotización
- **AND** las coberturas tienen deducibles especificados
- **THEN** la respuesta JSON incluye el campo `deductibleAnalysis` con el riesgo calculado por cobertura

#### Scenario: Deducible sin tope identificado
- **WHEN** una cobertura tiene deducible sin tope máximo
- **THEN** el análisis indica riesgo HIGH
- **AND** se incluye recomendación de negociación

### Requirement: Visualización de riesgo de deducibles
El sistema DEBE visualizar el nivel de riesgo de cada deducible en el reporte comparativo.

#### Scenario: Gauge de riesgo por deducible
- **WHEN** el usuario visualiza el reporte comparativo
- **AND** existen datos de `deductibleAnalysis`
- **THEN** se muestra un gauge visual indicando el nivel de riesgo (LOW/MEDIUM/HIGH) por cobertura

#### Scenario: Comparación de deducibles contextualizada
- **WHEN** el usuario compara múltiples cotizaciones
- **THEN** el análisis de riesgo considera el valor asegurado proporcional
- **AND** destaca deducibles que representan >15% del valor asegurado

## MODIFIED Requirements

### Requirement: Cálculo de riesgo de deducibles
El sistema DEBE calcular el riesgo de cada deducible considerando el valor asegurado y topes.

#### Scenario: Deducible bajo riesgo
- **WHEN** el deducible representa <10% del valor asegurado
- **THEN** el riesgo es LOW
- **AND** el score es ≥80

#### Scenario: Deducible medio riesgo
- **WHEN** el deducible representa entre 10-15% del valor asegurado
- **THEN** el riesgo es MEDIUM
- **AND** el score es entre 50-79

#### Scenario: Deducible alto riesgo
- **WHEN** el deducible representa >15% del valor asegurado
- **THEN** el riesgo es HIGH
- **AND** se genera recomendación de negociación
- **AND** se incluye en la respuesta de `/api/analyze`
