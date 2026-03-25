## MODIFIED Requirements

### Requirement: Vector storage uses Supabase instead of ChromaDB
The system SHALL store document chunks and embeddings in Supabase using the pgvector extension instead of ChromaDB.

#### Scenario: Store chunks in Supabase
- **WHEN** the system indexes a clause document
- **THEN** chunks SHALL be stored in the Supabase `chunks` table with embeddings
- **AND** the `document_id` field SHALL reference the parent document

#### Scenario: Search chunks using vector similarity
- **WHEN** a user searches for clauses semantically
- **THEN** the system SHALL use Supabase RPC function `match_chunks` with cosine similarity
- **AND** return chunks ordered by similarity score

#### Scenario: List indexed documents
- **WHEN** the system lists indexed clause documents
- **THEN** it SHALL query the Supabase `documents` and `chunks` tables
- **AND** return document metadata with chunk counts

#### Scenario: Delete indexed document
- **WHEN** the system deletes a clause document
- **THEN** it SHALL remove all associated chunks from Supabase `chunks` table
- **AND** remove the document record from `documents` table

## REMOVED Requirements

### Requirement: ChromaDB vector storage
**Reason**: Migrated to Supabase/pgvector for consistency and deployment compatibility
**Migration**: Re-index any documents that were stored in ChromaDB using the Supabase-based indexing endpoints

#### Scenario: ChromaDB client initialization (REMOVED)
- **WHEN** the system starts
- **THEN** it SHALL NOT attempt to connect to ChromaDB at localhost:8000
- **AND** it SHALL NOT import the `chromadb` package

#### Scenario: ChromaDB collection management (REMOVED)
- **WHEN** storing chunks for an insurer
- **THEN** it SHALL NOT create ChromaDB collections
- **AND** it SHALL NOT use ChromaDB-specific APIs

## ADDED Requirements

### Requirement: Backward compatibility for RAG API
The RAG API endpoints SHALL maintain the same request/response contracts while using Supabase internally.

#### Scenario: Index clause via RAG endpoint
- **WHEN** a POST request is made to `/api/rag/clauses` with a PDF file
- **THEN** the system SHALL extract text, create chunks, generate embeddings
- **AND** store them in Supabase (not ChromaDB)
- **AND** return the same response format as before

#### Scenario: Search clauses via RAG endpoint
- **WHEN** a POST request is made to `/api/rag/search` with a query
- **THEN** the system SHALL perform vector similarity search using Supabase
- **AND** return results in the same format as the ChromaDB implementation

#### Scenario: List clauses via RAG endpoint
- **WHEN** a GET request is made to `/api/rag/clauses`
- **THEN** the system SHALL query Supabase for documents and chunks
- **AND** return the list in the expected format
