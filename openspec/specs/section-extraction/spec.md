# Section Extraction

Capacidad de extraer secciones específicas (Exclusiones, Deducibles, Garantías) de clausulados.

## ADDED Requirements

### Requirement: Extracción de secciones clave

El sistema debe identificar y extraer las 3 secciones críticas de un clausulado.

#### Scenario: Extraer exclusiones

- **WHEN** se procesa un clausulado para extracción
- **THEN** el sistema identifica la sección de "Exclusiones" o "Riesgos No Cubiertos"
- **AND** extrae el texto completo de esa sección

#### Scenario: Extraer deducibles

- **WHEN** se procesa un clausulado para extracción
- **THEN** el sistema identifica la sección de "Deducibles" o "Franquicias"
- **AND** extrae tablas y condiciones de deducibles

#### Scenario: Extraer garantías

- **WHEN** se procesa un clausulado para extracción
- **THEN** el sistema identifica "Garantías", "Obligaciones del Asegurado" o "Condiciones"
- **AND** extrae los requisitos para validez del seguro

### Requirement: Procesamiento automático al crear clausulado

#### Scenario: Extracción en creación

- **WHEN** se crea un nuevo clausulado en la biblioteca
- **THEN** automáticamente se extraen las 3 secciones
- **AND** se almacenan en el campo `secciones` del documento

#### Scenario: Re-extracción manual

- **WHEN** un admin solicita re-extraer secciones de un clausulado existente
- **THEN** el sistema reprocesa y actualiza las secciones
