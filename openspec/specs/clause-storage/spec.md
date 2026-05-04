# Spec: Clause Storage

## Capability
Almacenamiento y gestión de clausulados pre-procesados en Supabase Storage para consulta RAG persistente en producción.

## ADDED Requirements

### Requirement: Almacenamiento de clausulados en Supabase Storage
El sistema DEBE almacenar los PDFs de clausulados en Supabase Storage para persistencia entre reinicios del servidor.

#### Scenario: Subida de clausulado a Supabase
- **WHEN** un admin sube un PDF de clausulado
- **THEN** el sistema almacena el archivo original en Supabase Storage (bucket 'clause-pages')
- **AND** extrae el texto y crea chunks vectorizados
- **AND** almacena los chunks en Supabase con embeddings para búsqueda RAG
- **AND** registra metadata (aseguradora, producto, versión) en la base de datos

#### Scenario: Recuperación de clausulado
- **WHEN** el sistema necesita consultar un clausulado para comparación
- **THEN** recupera los chunks vectorizados de Supabase
- **AND** realiza búsqueda semántica via embeddings
- **AND** no necesita acceder al archivo PDF original

### Requirement: Indexación de clausulados para RAG
El sistema DEBE procesar y indexar clausulados para búsqueda semántica eficiente.

#### Scenario: Indexación de nuevo clausulado
- **WHEN** se sube un nuevo clausulado
- **THEN** el sistema extrae texto de cada página
- **AND** divide en chunks semánticos
- **AND** genera embeddings para cada chunk usando Gemini
- **AND** almacena chunks + embeddings en Supabase

#### Scenario: Búsqueda semántica de cláusulas
- **WHEN** se compara una cotización contra clausulados
- **THEN** el sistema convierte las coberturas de la cotización a embeddings
- **AND** busca chunks similares en Supabase via cosine similarity
- **AND** retorna las cláusulas más relevantes con score de similitud

## MODIFIED Requirements

### Requirement: Almacenamiento de clausulados
El sistema DEBE almacenar clausulados con metadata estructurada para búsqueda y reutilización.

#### Scenario: Crear nuevo clausulado en producción
- **WHEN** un admin sube un PDF de clausulado con metadata (aseguradora, producto, año)
- **THEN** el sistema almacena el PDF en Supabase Storage
- **AND** extrae texto y crea chunks vectorizados
- **AND** genera hash SHA256 para detección de cambios
- **AND** registra fecha de creación en Supabase

#### Scenario: Buscar clausulados por aseguradora
- **WHEN** se solicita lista de clausulados para una aseguradora
- **THEN** el sistema consulta Supabase por aseguradora
- **AND** retorna todos los clausulados activos con producto, versión y fecha

## REMOVED Requirements

### Requirement: Almacenamiento en Firestore
**Reason**: Se migra de Firestore a Supabase para unificar la base de datos y aprovechar pgvector para búsqueda semántica.
**Migration**: Los clausulados existentes en Firestore deben migrarse a Supabase Storage + PostgreSQL.
