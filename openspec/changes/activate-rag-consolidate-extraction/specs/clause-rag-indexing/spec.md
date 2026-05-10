## MODIFIED Requirements

### Requirement: Async clause document upload
The system SHALL accept clause document uploads asynchronously and process them in the background.

#### Scenario: Successful upload
- **WHEN** a user uploads a clause PDF via POST /api/documents
- **THEN** the system returns immediately with a documentId
- **AND** the document is processed by DocumentIndexingService
- **AND** chunks are stored in unified `chunks` table (3072 dims)
- **AND** the user can check status via GET /api/documents/:id

## REMOVED Requirements

### Requirement: Store embeddings in clause_chunks
**Reason**: Consolidated into unified `chunks` table with 3072 dimensions
**Migration**: All new clause indexing uses `chunks` table. Existing data in `clause_chunks` remains for reference but is deprecated.

#### Scenario: Embedding creation (REMOVED)
- **WHEN** a chunk is created during clause processing
- **THEN** ~~the system generates a 768-dimensional embedding~~ (changed to 3072 dims in `chunks`)
- **AND** ~~stores the embedding in the clause_chunks table~~ (changed to `chunks` table)
