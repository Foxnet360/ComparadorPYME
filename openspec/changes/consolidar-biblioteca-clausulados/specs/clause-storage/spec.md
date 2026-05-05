## MODIFIED Requirements

### Requirement: Almacenamiento de clausulados en Supabase Storage
El sistema DEBE almacenar los PDFs de clausulados en Supabase Storage para persistencia entre reinicios del servidor, usando la tabla documents como única fuente de verdad.

#### Scenario: Subida de clausulado a Supabase
- **WHEN** un admin sube un PDF de clausulado
- **THEN** el sistema almacena el archivo original en Supabase Storage (bucket 'clause-pages')
- **AND** extrae el texto y crea chunks vectorizados
- **AND** almacena los chunks en Supabase con embeddings para búsqueda RAG
- **AND** registra metadata en tabla documents: aseguradora, producto, versión, is_active

#### Scenario: Recuperación de clausulado
- **WHEN** el sistema necesita consultar un clausulado para comparación
- **THEN** recupera los chunks vectorizados de tabla chunks en Supabase
- **AND** realiza búsqueda semántica via embeddings
- **AND** no necesita acceder al archivo PDF original

### Requirement: Indexación de clausulados para RAG
El sistema DEBE procesar y indexar clausulados para búsqueda semántica eficiente, usando Gemini Embedding 2.

#### Scenario: Indexación de nuevo clausulado
- **WHEN** se sube un nuevo clausulado
- **THEN** el sistema extrae texto de cada página
- **AND** divide en chunks semánticos
- **AND** genera embeddings para cada chunk usando Gemini Embedding 2 (3072 dims)
- **AND** almacena chunks + embeddings en tabla chunks

## REMOVED Requirements

### Requirement: Dual storage system
**Reason**: Consolidated to single documents + chunks table structure
**Migration**: Legacy clause_chunks table is deprecated. All new indexing uses documents + chunks tables only.
