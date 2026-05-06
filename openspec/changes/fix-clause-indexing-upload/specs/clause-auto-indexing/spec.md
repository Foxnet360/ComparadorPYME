## ADDED Requirements

### Requirement: Indexación automática de clausulados en análisis avanzado
El sistema DEBE indexar automáticamente los clausulados subidos en las tablas `clause_chunks` y `clause_coverages` para que los servicios de análisis avanzado puedan encontrarlos.

#### Scenario: Upload de clausulado dispara indexación dual
- **WHEN** un usuario sube un PDF de tipo `CLAUSULADO_GENERAL` o `CLAUSULADO_PARTICULAR`
- **AND** el documento se indexa exitosamente en `documents` + `chunks`
- **THEN** el sistema DEBE ejecutar automáticamente `clauseIndexer.startIndexing()`
- **AND** generar embeddings en `clause_chunks`
- **AND** extraer coberturas en `clause_coverages`
- **AND** ambos procesos completarse sin errores

#### Scenario: Upload de cotización no dispara indexación de clausulados
- **WHEN** un usuario sube un PDF de tipo `COTIZACION` o `ANEXO`
- **THEN** el sistema NO DEBE ejecutar `clauseIndexer`
- **AND** solo debe indexar en `documents` + `chunks` como antes

#### Scenario: Fallo en indexación de clausulados no afecta upload principal
- **WHEN** un usuario sube un clausulado
- **AND** la indexación en `documents` es exitosa
- **AND** la indexación en `clause_chunks` falla
- **THEN** el upload principal DEBE considerarse exitoso
- **AND** el error DEBE loguearse pero no mostrarse al usuario
- **AND** el sistema DEBE permitir re-intentar la indexación posteriormente

## MODIFIED Requirements

### Requirement: Almacenamiento de clausulados con metadata estructurada
El sistema DEBE almacenar clausulados con metadata estructurada incluyendo versión y estado activo.

#### Scenario: Crear nuevo clausulado en producción
- **WHEN** un admin sube un PDF de clausulado con metadata (aseguradora, producto, versión, año)
- **THEN** el sistema almacena el PDF en Supabase Storage
- **AND** extrae texto y crea chunks vectorizados en `chunks`
- **AND** extrae texto y crea chunks vectorizados en `clause_chunks`
- **AND** genera hash SHA256 para detección de cambios
- **AND** registra versión y fecha de creación en tabla documents
- **AND** marca como is_active = true (o archiva versión anterior si existe)
- **AND** registra coberturas extraídas en `clause_coverages`
