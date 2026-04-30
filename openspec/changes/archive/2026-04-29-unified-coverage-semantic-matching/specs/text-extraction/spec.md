## ADDED Requirements

### Requirement: Campos de mapeo semántico en extracción
La extracción de texto de cotizaciones SHALL enriquecer cada cobertura con campos de categorización canónica.

#### Scenario: Respuesta de API enriquecida
- **WHEN** el endpoint `/api/analyze` procesa cotizaciones
- **THEN** cada objeto `coverage` en la respuesta incluye: `canonicalName`, `categoryId`, `matchConfidence`, `matchMethod`

#### Scenario: Compatibilidad hacia atrás
- **WHEN** un cliente legacy consume la API
- **THEN** los campos nuevos son adicionales y no requieren cambios en el cliente

## MODIFIED Requirements

### Requirement: Extracción de datos estructurados de cotización
El sistema SHALL extraer coberturas de cotizaciones de seguros y enriquecer cada cobertura con metadatos de categorización canónica.

#### Scenario: Extracción con categorización
- **WHEN** el sistema extrae coberturas de una cotización
- **THEN** para cada cobertura se determina: nombre original, nombre canónico (de las 14 categorías), categoryId (1-14 o null), confianza del match (0-1), y método usado (thesaurus/fuzzy/embedding/llm)

#### Scenario: Validación de salida
- **WHEN** el sistema completa la extracción
- **THEN** el objeto CoverageItem incluye los campos: name, value, description, isPositive, canonicalName, categoryId, matchConfidence, matchMethod
