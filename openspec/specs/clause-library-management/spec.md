## ADDED Requirements

### Requirement: Auto-archive on new version upload
The system SHALL automatically archive existing active clause documents when a new version is uploaded for the same insurer and document type.

#### Scenario: New upload archives previous version
- **WHEN** uploading a new clause document for insurer "AXA" with type "CLAUSULADO_GENERAL"
- **AND** an active version already exists
- **THEN** the existing document SHALL be archived (is_active = false)
- **AND** the new document SHALL become active

### Requirement: Support multiple active documents per insurer
The system SHALL allow multiple clause documents to be active for the same insurer when they have different document types or product names.

#### Scenario: Multiple document types active
- **WHEN** insurer "AXA" has active documents:
  - "CLAUSULADO_GENERAL" (version 2024.1)
  - "CLAUSULADO_PARTICULAR" (version 2024.1)
- **THEN** both SHALL remain active simultaneously

## MODIFIED Requirements

### Requirement: Upload and index new clause documents
The system SHALL support uploading new clause PDF documents and automatically index them into the vector store, with automatic version management.

#### Scenario: Upload new clause document
- **WHEN** a user uploads a clause PDF with insurer name, document type, version, and product name
- **THEN** the system SHALL extract text, create chunks, generate embeddings, and store in vector DB
- **AND** if an active document exists for same insurer+type+product, archive it first
- **AND** mark the new document as active

### Requirement: List indexed clause documents
The system SHALL provide a list of all indexed clause documents with their metadata, including version history.

#### Scenario: List all documents
- **WHEN** a list request is made
- **THEN** the system SHALL return array of documents with: insurer_name, document_name, product_name, version, is_active, indexed_at, chunk_count

#### Scenario: Filter by active status
- **WHEN** list is requested with `is_active=true`
- **THEN** results SHALL only include active documents

### Requirement: Re-index existing documents
The system SHALL support re-indexing a document to update its chunks, creating a new version.

#### Scenario: Re-index updated clause
- **WHEN** a document is re-indexed
- **THEN** existing chunks SHALL be preserved for the old version
- **AND** a new version SHALL be created with new chunks
- **AND** the new version SHALL become active

## REMOVED Requirements

### Requirement: In-memory clause tracking
**Reason**: Replaced by persistent storage in Supabase documents table
**Migration**: All clause data now stored in Supabase, no in-memory tracking needed
