## ADDED Requirements

### Requirement: Async clause document upload
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

### Requirement: Clause chunking with metadata
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

### Requirement: Embedding generation and storage
The system SHALL generate embeddings for clause chunks and store them in Supabase pgvector.

#### Scenario: Embedding creation
- **WHEN** a chunk is created during clause processing
- **THEN** the system generates a 768-dimensional embedding using Gemini embedding-001
- **AND** stores the embedding in the clause_chunks table

#### Scenario: Batch embedding
- **WHEN** 100 chunks are created from a large clause document
- **THEN** embeddings are generated in batches of 50
- **AND** all chunks are stored within 30 seconds

### Requirement: Hybrid search retrieval
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