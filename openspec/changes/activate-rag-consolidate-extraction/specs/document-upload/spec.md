## MODIFIED Requirements

### Requirement: Almacenamiento de clausulados con metadata estructurada
El sistema DEBE almacenar clausulados con metadata estructurada incluyendo versión y estado activo.

#### Scenario: Crear nuevo clausulado en producción
- **WHEN** un admin sube un PDF de clausulado con metadata (aseguradora, producto, versión, año)
- **THEN** el sistema almacena el PDF en Supabase Storage
- **AND** extrae texto y crea chunks vectorizados en tabla `chunks` (3072 dims)
- **AND** genera hash SHA256 para detección de cambios
- **AND** registra versión y fecha de creación en tabla documents
- **AND** marca como is_active = true (o archiva versión anterior si existe)
- **AND** NO crea duplicados en `clause_chunks` (tabla deprecated)

## REMOVED Requirements

### Requirement: Dual indexing in clause_chunks
**Reason**: Consolidated into unified `chunks` table
**Migration**: Remove call to `clauseIndexer.startIndexing()` from documentController. DocumentIndexingService handles all indexing.

#### Scenario: Upload triggers clause indexing (REMOVED)
- **WHEN** a clause document is uploaded
- **THEN** ~~the system triggers clauseIndexer for clause_chunks~~ (removed, now uses unified `chunks` only)
