# Clause Library Management

## ADDED Requirements

### Requirement: Upload and index new clause documents
The system SHALL support uploading new clause PDF documents and automatically index them into the vector store.

#### Scenario: Upload new clause document
- **WHEN** a user uploads a clause PDF with insurer name and document type
- **THEN** the system SHALL extract text, create chunks, generate embeddings, and store in vector DB

#### Scenario: Confirm successful indexing
- **WHEN** indexing completes successfully
- **THEN** the system SHALL return success with count of chunks created

### Requirement: List indexed clause documents
The system SHALL provide a list of all indexed clause documents with their metadata.

#### Scenario: List all documents
- **WHEN** a list request is made
- **THEN** the system SHALL return array of documents with: insurer_name, document_name, indexed_at, chunk_count

#### Scenario: Filter by insurer
- **WHEN** list is requested with insurer filter
- **THEN** results SHALL only include documents from that insurer

### Requirement: Re-index existing documents
The system SHALL support re-indexing a document to update its chunks in the vector store.

#### Scenario: Re-index updated clause
- **WHEN** a document is re-indexed with same insurer and document name
- **THEN** existing chunks SHALL be replaced with new chunks

### Requirement: Delete clause documents
The system SHALL support deleting indexed clause documents from the vector store.

#### Scenario: Delete document
- **WHEN** delete request specifies insurer and document name
- **THEN** all chunks from that document SHALL be removed

### Requirement: Validate document before indexing
The system SHALL validate that uploaded documents meet requirements before processing.

#### Scenario: Reject non-PDF files
- **WHEN** a non-PDF file is uploaded
- **THEN** the system SHALL reject with error "Only PDF files are supported"

#### Scenario: Reject empty PDFs
- **WHEN** a PDF with no extractable text is uploaded
- **THEN** the system SHALL reject with error "PDF contains no extractable text"
