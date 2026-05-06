## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir el análisis de coberturas omitidas en la respuesta del endpoint `/api/analyze`.

#### Scenario: Coberturas omitidas incluidas en respuesta
- **WHEN** el sistema completa el análisis de una cotización
- **AND** existen coberturas en el clausulado que no están en la cotización
- **THEN** la respuesta JSON incluye el campo `inverseCoverageCheck` con las coberturas omitidas

#### Scenario: Distinguir obligatorias vs opcionales
- **WHEN** se detectan coberturas omitidas
- **THEN** se distingue entre coberturas obligatorias (MANDATORY_MISSING) y opcionales (OPTIONAL_MISSING)
- **AND** las obligatorias generan alertas más prominentes

### Requirement: Alertas de coberturas omitidas
El sistema DEBE mostrar alertas visuales cuando existan coberturas obligatorias omitidas.

#### Scenario: Alerta de cobertura obligatoria omitida
- **WHEN** una cobertura obligatoria está omitida
- **THEN** se muestra `InverseCoverageAlert` con nivel CRITICAL
- **AND** indica el nombre de la cobertura omitida
- **AND** sugiere verificar con la aseguradora

#### Scenario: Información de cobertura opcional omitida
- **WHEN** una cobertura opcional está omitida
- **THEN** se muestra con nivel INFO
- **AND** indica que es opcional pero recomendable

## MODIFIED Requirements

### Requirement: Detección de coberturas omitidas
El sistema DEBE detectar coberturas que están en el clausulado pero no en la cotización.

#### Scenario: Cobertura obligatoria omitida detectada
- **WHEN** el clausulado incluye "Responsabilidad Civil" como obligatoria
- **AND** la cotización no incluye esta cobertura
- **THEN** se genera alerta CRITICAL
- **AND** se incluye en la respuesta de `/api/analyze` con `status: "MANDATORY_MISSING"`

#### Scenario: Cobertura opcional omitida detectada
- **WHEN** el clausulado incluye "Vidrios Planos" como opcional
- **AND** la cotización no incluye esta cobertura
- **THEN** se genera alerta INFO
- **AND** se incluye en la respuesta de `/api/analyze` con `status: "OPTIONAL_MISSING"`
