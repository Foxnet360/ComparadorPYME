# Spec: Pipeline Scalability

## Capability
Optimizaciones de escalabilidad del pipeline de indexación de documentos para manejar documentos grandes sin fugas de memoria ni datos huérfanos.

## User Story
**Como** administrador del sistema
**Quiero** indexar documentos grandes de forma confiable
**Para** que el sistema no se bloquee ni deje datos inconsistentes

## Functional Requirements

### FR-1: Leak-free PDF parsing
The system SHALL ensure that all PDF.js document instances and associated resources are explicitly destroyed after extraction completes or fails.

#### Scenario: Successful PDF extraction
- **WHEN** a PDF is successfully parsed and text is extracted
- **THEN** the system calls `destroy()` on the PDF.js document instance
- **AND** memory is freed without leaving internal cache references

#### Scenario: Failed PDF extraction
- **WHEN** a PDF parsing operation throws an error
- **THEN** the system guarantees the `destroy()` method is still called via a `finally` block

### FR-2: Atomic document indexing
The system SHALL ensure that a document, its rendered images, and its semantic chunks are stored in the database atomically to prevent orphaned data.

#### Scenario: Successful indexing
- **WHEN** the document processing pipeline finishes successfully
- **THEN** the document record, page images, and chunks are committed to the database in a single transaction

#### Scenario: Chunk insertion failure
- **WHEN** an error occurs while inserting chunks into the database
- **THEN** the entire transaction is rolled back
- **AND** no orphaned document record or page images remain in the database

### FR-3: Guaranteed temporary file cleanup
The system SHALL ensure that temporary uploaded PDF files are deleted from the filesystem regardless of processing success or failure.

#### Scenario: Processing failure
- **WHEN** document indexing throws an exception
- **THEN** the temporary file created by multer is deleted from the disk

## Optimizaciones Implementadas
- Batch size de embeddings aumentado de 5 a 50
- Eliminación de N+1 queries en listDocuments
- Uso de RPC transaccional para indexación atómica
- Lectura asíncrona de archivos en lugar de síncrona

## Dependencies
- Supabase con funciones RPC
- PDF.js con manejo explícito de destroy()
- Multer para upload de archivos
