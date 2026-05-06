## Delta Spec

### Requirement: Validación bidireccional

El sistema DEBE soportar validación en ambas direcciones: quote → clausulado y clausulado → quote.

#### Scenario: Cobertura fantasma
- **WHEN** una cobertura está en la cotización pero no en el clausulado
- **THEN** se genera alerta CRITICAL con referencia al intento de validación

#### Scenario: Cobertura obligatoria omitida
- **WHEN** una cobertura está en el clausulado (obligatoria) pero no en la cotización
- **THEN** se genera alerta WARNING indicando la omisión

### Requirement: Extracción de datos del clausulado mejorada

El cross-reference DEBE extraer más información del clausulado.

#### Scenario: Datos extraídos mejorados
- **WHEN** se cruza una cobertura contra el clausulado
- **THEN** se extrae:
  - Valor del deducible (existente)
  - Exclusiones (existente)
  - Condiciones (existente)
  - **NUEVO**: Tope máximo del deducible
  - **NUEVO**: Indicador de cobertura obligatoria vs opcional
  - **NUEVO**: Referencia a artículo/sección específica
