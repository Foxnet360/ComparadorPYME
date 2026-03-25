# Vector Storage

## ADDED Requirements

### Requirement: Store document chunks in vector database
The system SHALL store semantic chunks with their embeddings in ChromaDB for efficient similarity search.

#### Scenario: Store chunk with embedding
- **WHEN** a semantic chunk is created with its embedding vector
- **THEN** the system SHALL store it in ChromaDB with the chunk text, metadata, and embedding

#### Scenario: Associate metadata with chunks
- **WHEN** chunks are stored
- **THEN** each chunk SHALL include metadata: insurer_name, document_name, document_type, chapter, section, clause_id, page_start, page_end

### Requirement: Query chunks by similarity
The system SHALL support similarity search to retrieve chunks most relevant to a query.

#### Scenario: Search by coverage name
- **WHEN** a search is performed with a coverage name like "Incendio"
- **THEN** the system SHALL return the top 5 most similar chunks from the clause database

#### Scenario: Filter by insurer
- **WHEN** a search includes an insurer filter
- **THEN** the results SHALL be limited to chunks from that insurer's documents only

### Requirement: Create collections per insurer
The system SHALL organize chunks by insurer to enable efficient filtered searches and separate management.

#### Scenario: Create insurer collection
- **WHEN** a new insurer's clauses are indexed for the first time
- **THEN** the system SHALL create a dedicated collection for that insurer

### Requirement: Handle duplicate clause indexing
The system SHALL handle re-indexing of clauses that already exist in the database without creating duplicates.

#### Scenario: Update existing document
- **WHEN** a clause document is re-indexed with the same insurer and document name
- **THEN** the system SHALL replace the existing chunks with the new ones

### Requirement: Delete clauses from vector store
The system SHALL support removing a clause document and all its associated chunks from the vector store.

#### Scenario: Delete document
- **WHEN** a delete request is made for a specific insurer and document
- **THEN** all chunks associated with that document SHALL be removed from the database
