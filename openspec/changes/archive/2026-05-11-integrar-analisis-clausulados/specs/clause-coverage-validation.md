## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir los resultados de validación de coberturas en la respuesta del endpoint `/api/analyze`.

#### Scenario: Validación incluida en respuesta de análisis
- **WHEN** el sistema completa el análisis de una cotización
- **AND** existen resultados de `clauseCoverageValidator`
- **THEN** la respuesta JSON incluye el campo `clauseValidation` con los resultados de validación

#### Scenario: Validación omitida cuando no hay datos
- **WHEN** el sistema analiza una cotización
- **AND** no hay documento de clausulado para la aseguradora
- **THEN** el campo `clauseValidation` está presente pero indica `hasClauseDocument: false`
- **AND** el score se penaliza en -20 puntos

### Requirement: Visualización en reporte comparativo
El sistema DEBE mostrar las métricas de validación en el reporte comparativo cuando existan datos.

#### Scenario: Métricas de validación visibles
- **WHEN** el usuario visualiza el reporte comparativo
- **AND** existen datos de `clauseValidation`
- **THEN** se muestran métricas de coberturas verificadas, fantasma y obligatorias omitidas

#### Scenario: Validación ausente no afecta UI
- **WHEN** el usuario visualiza el reporte comparativo
- **AND** no existen datos de `clauseValidation`
- **THEN** las métricas de validación no se muestran o muestran "No disponible"
- **AND** el resto del reporte funciona normalmente

## MODIFIED Requirements

### Requirement: Validación bidireccional de coberturas
El sistema DEBE soportar validación en ambas direcciones: quote → clausulado y clausulado → quote.

#### Scenario: Cobertura fantasma detectada
- **WHEN** una cobertura está en la cotización pero no en el clausulado
- **THEN** se genera alerta CRITICAL con referencia al intento de validación
- **AND** se incluye en la respuesta de `/api/analyze` con `status: "PHANTOM"`

#### Scenario: Cobertura obligatoria omitida
- **WHEN** una cobertura está en el clausulado (obligatoria) pero no en la cotización
- **THEN** se genera alerta WARNING indicando la omisión
- **AND** se incluye en la respuesta de `/api/analyze` con `status: "MANDATORY_MISSING"`

### Requirement: Extracción de datos del clausulado mejorada
El cross-reference DEBE extraer más información del clausulado.

#### Scenario: Datos extraídos mejorados
- **WHEN** se cruza una cobertura contra el clausulado
- **THEN** se extrae:
  - Valor del deducible (existente)
  - Exclusiones (existente)
  - Condiciones (existente)
  - Tope máximo del deducible
  - Indicador de cobertura obligatoria vs opcional
  - Referencia a artículo/sección específica
- **AND** estos datos están disponibles en la respuesta de `/api/analyze`
