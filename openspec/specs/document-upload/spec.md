## ADDED Requirements

### Requirement: Support version field in document upload
The system SHALL accept a version field when uploading clause documents.

#### Scenario: Upload with version
- **WHEN** uploading a clause document with version "2024.1"
- **THEN** the system SHALL store the version in the documents table
- **AND** display it in all listings

### Requirement: Auto-archive previous active version
The system SHALL automatically archive the previous active version when uploading a new document for the same insurer, product, and type.

#### Scenario: New version replaces old
- **WHEN** uploading a document for insurer "AXA", product "PYME", type "CLAUSULADO_GENERAL"
- **AND** an active document already exists for that combination
- **THEN** the system SHALL archive the existing document first
- **AND** then store and activate the new document

## MODIFIED Requirements

### Requirement: Almacenamiento de clausulados con metadata estructurada
El sistema DEBE almacenar clausulados con metadata estructurada incluyendo versión y estado activo.

#### Scenario: Crear nuevo clausulado en producción
- **WHEN** un admin sube un PDF de clausulado con metadata (aseguradora, producto, versión, año)
- **THEN** el sistema almacena el PDF en Supabase Storage
- **AND** extrae texto y crea chunks vectorizados
- **AND** genera hash SHA256 para detección de cambios
- **AND** registra versión y fecha de creación en tabla documents
- **AND** marca como is_active = true (o archiva versión anterior si existe)

#### Scenario: Buscar clausulados por aseguradora
- **WHEN** se solicita lista de clausulados para una aseguradora
- **THEN** el sistema consulta tabla documents por aseguradora
- **AND** retorna todos los clausulados con producto, versión, estado y fecha
- **AND** permite filtrar por is_active
