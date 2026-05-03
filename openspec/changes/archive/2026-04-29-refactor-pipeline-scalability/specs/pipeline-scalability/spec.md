## ADDED Requirements

### Requirement: Leak-free PDF parsing
The system SHALL ensure that all PDF.js document instances and associated resources are explicitly destroyed after extraction completes or fails.

#### Scenario: Successful PDF extraction
- **WHEN** a PDF is successfully parsed and text is extracted
- **THEN** the system calls `destroy()` on the PDF.js document instance
- **AND** memory is freed without leaving internal cache references

#### Scenario: Failed PDF extraction
- **WHEN** a PDF parsing operation throws an error
- **THEN** the system guarantees the `destroy()` method is still called via a `finally` block

### Requirement: Atomic document indexing
The system SHALL ensure that a document, its rendered images, and its semantic chunks are stored in the database atomically to prevent orphaned data.

#### Scenario: Successful indexing
- **WHEN** the document processing pipeline finishes successfully
- **THEN** the document record, page images, and chunks are committed to the database in a single transaction

#### Scenario: Chunk insertion failure
- **WHEN** an error occurs while inserting chunks into the database
- **THEN** the entire transaction is rolled back
- **AND** no orphaned document record or page images remain in the database

### Requirement: Guaranteed temporary file cleanup
The system SHALL ensure that temporary uploaded PDF files are deleted from the filesystem regardless of processing success or failure.

#### Scenario: Processing failure
- **WHEN** document indexing throws an exception
- **THEN** the temporary file created by multer is deleted from the disk
