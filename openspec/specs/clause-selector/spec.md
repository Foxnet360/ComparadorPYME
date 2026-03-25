# Clause Selector UI

Capacidad de seleccionar clausulados de la biblioteca durante el análisis de cotizaciones.

## ADDED Requirements

### Requirement: Selector de clausulados en flujo de análisis

El sistema MUST proporcionar un selector de clausulados en el flujo de análisis de cotizaciones.

#### Scenario: Seleccionar clausulados pre-cargados

- **WHEN** el usuario sube cotizaciones para análisis
- **THEN** se MUST mostrar un selector de clausulados disponibles en la biblioteca
- **AND** el usuario SHALL poder seleccionar múltiples clausulados relevantes

#### Scenario: Análisis sin subir PDFs de clausulados

- **WHEN** el usuario selecciona clausulados de la biblioteca
- **THEN** el sistema MUST usar las secciones pre-extraídas
- **AND** NO MUST requerir subir PDFs de clausulados

### Requirement: Compatibilidad con flujo actual

El sistema MUST mantener compatibilidad con el flujo tradicional de upload de clausulados.

#### Scenario: Upload tradicional de clausulados

- **WHEN** el usuario prefiere subir clausulados manualmente
- **THEN** el sistema MUST permitir upload como antes
- **AND** SHOULD ofrecer opción de guardar en biblioteca para futuro uso

## MODIFIED Requirements

### Requirement: Análisis usa secciones en lugar de documentos completos

El sistema MUST optimizar el uso de tokens enviando solo secciones relevantes en lugar de documentos completos.

#### Scenario: Prompt optimizado

- **WHEN** se envía análisis a Gemini con clausulados de biblioteca
- **THEN** solo se MUST enviar las secciones (exclusiones, deducibles, garantías)
- **AND** el prompt MUST indicar que son secciones extraídas