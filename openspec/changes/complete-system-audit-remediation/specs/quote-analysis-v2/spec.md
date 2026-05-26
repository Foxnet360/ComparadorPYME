## MODIFIED Requirements

### Requirement: Text-based quote analysis
The system SHALL analyze insurance quotes using **multimodal PDF extraction** followed by post-normalization, instead of text-based extraction with deterministic parsing. **ADDED**: The system SHALL process quotes with proper synchronization to prevent race conditions.

#### Scenario: Parallel processing with synchronization
- **WHEN** multiple quotes are processed
- **THEN** the system SHALL use `Promise.all` with proper result mapping
- **AND** SHALL NOT use array index assignment in async batches
- **AND** results SHALL maintain correct order

#### Scenario: Timeout with cancellation
- **WHEN** a quote extraction exceeds the timeout
- **THEN** the underlying Gemini request SHALL be cancelled via AbortController
- **AND** resources SHALL be freed

#### Scenario: Idempotent analysis history
- **WHEN** an analysis is saved to history
- **THEN** an idempotency key SHALL prevent duplicate entries
- **AND** retrying the same analysis SHALL NOT create duplicates

## ADDED Requirements

### Requirement: Input Validation for Analysis
The system SHALL validate all inputs to the analysis endpoint.

#### Scenario: Missing quote files
- **WHEN** a request has no quote files
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "No quote files uploaded"

#### Scenario: Invalid file type
- **WHEN** a non-PDF file is uploaded as a quote
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "Only PDF files are allowed"

#### Scenario: Malformed multipart request
- **WHEN** the multipart request is malformed
- **THEN** the system SHALL respond with HTTP 400
- **AND** SHALL NOT crash with TypeError
