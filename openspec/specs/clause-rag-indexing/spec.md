# Spec: Clause RAG Indexing

## Capability
Indexación asíncrona de documentos de cláusulas con chunking semántico, embeddings y almacenamiento en pgvector para búsqueda híbrida.

## User Story
**Como** administrador del sistema
**Quiero** subir documentos de cláusulas de aseguradoras
**Para** que el sistema pueda recuperar cláusulas relevantes durante el análisis de cotizaciones

## Functional Requirements

### FR-1: Async clause document upload
The system SHALL accept clause document uploads asynchronously and process them in the background.

#### Scenario: Successful upload
- **WHEN** a user uploads a clause PDF via POST /api/clauses/index
- **THEN** the system returns immediately with a jobId
- **AND** the document is queued for background processing
- **AND** the user can check status via GET /api/clauses/status/:jobId

#### Scenario: Upload with existing insurer
- **WHEN** a clause is uploaded for an insurer that already has clauses
- **THEN** the new clauses are indexed alongside existing ones
- **AND** old versions are marked as deprecated but retained for historical queries

### FR-2: Clause chunking with metadata
The system SHALL chunk clause documents into semantic sections with rich metadata for retrieval.

#### Scenario: Chapter-level chunking
- **WHEN** a 50-page clause document is processed
- **THEN** the system creates chunks at chapter/section boundaries
- **AND** each chunk includes: insurer_name, document_type, section_type, coverage_tags
- **AND** chunks have 200-character overlap with adjacent chunks

#### Scenario: Coverage detection
- **WHEN** a chunk contains text about "incendio" or "daño material"
- **THEN** the system tags the chunk with coverage "Incendio (Edificio y Contenidos)"
- **AND** uses the thesaurus to match synonyms

### FR-3: Embedding generation and storage
The system SHALL generate embeddings for clause chunks and store them in Supabase pgvector.

#### Scenario: Embedding creation
- **WHEN** a chunk is created during clause processing
- **THEN** the system generates a 768-dimensional embedding using Gemini embedding-001
- **AND** stores the embedding in the clause_chunks table

#### Scenario: Batch embedding
- **WHEN** 100 chunks are created from a large clause document
- **THEN** embeddings are generated in batches of 50
- **AND** all chunks are stored within 30 seconds

### FR-4: Hybrid search retrieval
The system SHALL support hybrid search combining vector similarity and full-text search.

#### Scenario: Vector similarity search
- **WHEN** a query embedding is provided for "incendio deducible"
- **THEN** the system finds semantically similar chunks using pgvector cosine similarity
- **AND** returns top 5 matches with similarity scores

#### Scenario: Full-text search
- **WHEN** a text query "deducible incendio 10%" is provided
- **THEN** the system uses PostgreSQL full-text search on content_normalized
- **AND** returns chunks containing those exact terms

#### Scenario: Combined hybrid search
- **WHEN** both vector and text queries are provided
- **THEN** the system combines results using weighted ranking
- **AND** returns the most relevant chunks from both methods

## Database Schema

### Table: clause_chunks
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| insurer_name | text | Nombre de la aseguradora |
| document_type | text | Tipo de documento (clausulado, anexo, etc) |
| section_type | text | Tipo de sección (cobertura, exclusión, deducible) |
| coverage_tags | text[] | Array de coberturas relacionadas |
| content | text | Texto del chunk |
| content_normalized | text | Texto normalizado para búsqueda full-text |
| embedding | vector(768) | Embedding del chunk |
| page_number | int | Número de página |
| metadata | jsonb | Metadata adicional |
| created_at | timestamp | Fecha de creación |

## Dependencies
- Supabase con extensión pgvector
- Gemini embedding-001 API
- Servicio de thesaurus para tagging de coberturas
