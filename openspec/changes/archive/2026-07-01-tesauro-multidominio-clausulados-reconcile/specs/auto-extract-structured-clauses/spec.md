# Delta for Structured Clause Extraction

## MODIFIED Requirements

### Requirement: Extract structured clause data from PDF
The system SHALL extract insurance clause documents into structured JSON format containing coverages, deductibles, exclusions, conditions, and definitions. The system SHALL automatically trigger extraction upon successful document upload and chunking when the `AUTO_EXTRACT_STRUCTURED_CLAUSES` feature flag is enabled.
(Previously: Extraction was available as a standalone operation but was never automatically invoked during the document upload pipeline.)

#### Scenario: Successful structured extraction
- **WHEN** a clause PDF is uploaded
- **THEN** the system extracts a JSON structure with all coverages, their descriptions, deductibles, sublimits, exclusions, and conditions
- **AND** each coverage includes the source page number
- **AND** the extraction completes in a single LLM call per document

#### Scenario: Automatic extraction on upload
- **GIVEN** the `AUTO_EXTRACT_STRUCTURED_CLAUSES` feature flag is enabled
- **WHEN** a clause PDF is uploaded via DocumentIndexingService
- **AND** chunking completes successfully
- **THEN** structuredClauseExtractor.extractFromText() SHALL be invoked automatically
- **AND** the extracted structured clause SHALL be stored in the structured_clauses table
- **AND** the extraction SHALL complete within 30 seconds

#### Scenario: Feature flag disabled
- **GIVEN** the `AUTO_EXTRACT_STRUCTURED_CLAUSES` feature flag is disabled
- **WHEN** a clause PDF is uploaded
- **THEN** the document SHALL be indexed into documents and chunks tables only
- **AND** structured_clauses SHALL NOT be automatically populated

#### Scenario: Extraction failure handling
- **GIVEN** the feature flag is enabled
- **WHEN** a clause PDF upload succeeds but extraction fails
- **THEN** the upload SHALL still be considered successful
- **AND** the failure SHALL be logged with document_id and error details
- **AND** a retry MAY be attempted asynchronously

## ADDED Requirements

### Requirement: Feature flag configuration
The system SHALL expose the `AUTO_EXTRACT_STRUCTURED_CLAUSES` flag in featureFlags.ts with a default value of false.

#### Scenario: Flag defaults to disabled
- **GIVEN** the application starts with no explicit flag configuration
- **THEN** `AUTO_EXTRACT_STRUCTURED_CLAUSES` SHALL default to false
- **AND** existing upload behavior SHALL remain unchanged
