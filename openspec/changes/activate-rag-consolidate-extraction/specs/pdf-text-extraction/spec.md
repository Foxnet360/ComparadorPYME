## MODIFIED Requirements

### Requirement: Extract text and metadata from PDF documents
The system SHALL extract text, page-level data, and metadata from uploaded PDF files.

#### Scenario: Extract text from PDF
- **WHEN** a PDF file is uploaded for processing
- **THEN** the system extracts text page by page
- **AND** returns structured data with text, word count, and page numbers
- **AND** detects if the PDF is scanned vs text-based
- **AND** IDENTIFIES the insurer from the extracted text using configured patterns

#### Scenario: Detect insurer from text
- **WHEN** processing a quote PDF from BBVA
- **THEN** the system SHALL detect "BBVA" from the text content
- **AND** return the detected insurer name
- **AND** use it to select the appropriate extraction profile

## ADDED Requirements

### Requirement: Insurer detection from PDF
The system SHALL automatically identify the insurance company from the PDF text.

#### Scenario: Detection by header text
- **WHEN** a PDF contains "BBVA Seguros Colombia" in the header
- **THEN** the system SHALL identify insurer as "BBVA"
- **AND** return confidence score

#### Scenario: Detection by metadata
- **WHEN** PDF metadata contains author "SBS SEGUROS"
- **THEN** the system SHALL identify insurer as "SBS"
- **AND** combine with text detection for higher confidence

#### Scenario: Unknown insurer fallback
- **WHEN** no insurer can be detected
- **THEN** the system SHALL return "UNKNOWN"
- **AND** use generic extraction profile
- **AND** log warning for manual review
