# PDF Text Extraction

## ADDED Requirements

### Requirement: Extract text from PDF with native text
The system SHALL extract text content from PDF files that contain selectable text using pdf-lib library.

#### Scenario: Extract text from valid PDF
- **WHEN** a PDF file with native text is provided to the extraction service
- **THEN** the service SHALL return a string containing all extracted text organized by pages

#### Scenario: Handle empty PDF
- **WHEN** a PDF file contains no text (only images)
- **THEN** the service SHALL return an empty string with a warning log

#### Scenario: Extract text with page references
- **WHEN** text is extracted from a multi-page PDF
- **THEN** each page's text SHALL include its page number in the metadata for citation purposes

### Requirement: Clean extracted text formatting
The system SHALL remove common PDF artifacts from extracted text including excessive whitespace, page numbers, and headers/footers.

#### Scenario: Remove page numbers
- **WHEN** extracted text contains isolated page numbers
- **THEN** the service SHALL filter out lines that are only numbers

#### Scenario: Normalize whitespace
- **WHEN** extracted text contains multiple consecutive whitespace characters
- **THEN** the service SHALL normalize to single spaces while preserving paragraph breaks

### Requirement: Extract metadata from PDF
The system SHALL extract metadata from PDF files including number of pages, title, and author when available.

#### Scenario: Get page count
- **WHEN** a PDF is processed
- **THEN** the service SHALL return the total page count in the metadata

### Requirement: Handle corrupted PDFs gracefully
The system SHALL handle corrupted or invalid PDF files without crashing and return appropriate error messages.

#### Scenario: Invalid PDF file
- **WHEN** a file that is not a valid PDF is provided
- **THEN** the service SHALL throw an error with message "Invalid PDF file"
