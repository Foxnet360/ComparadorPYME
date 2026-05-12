# Spec: PDF Text Extraction V2

## Capability
Extracción de texto de PDFs para detección de formato familiar, preservando la extracción original para fallback y otros servicios.

## User Story
**Como** sistema de análisis
**Quiero** extraer texto de PDFs rápidamente
**Para** detectar el formato familiar antes de la extracción multimodal

## MODIFIED Requirements

### Requirement: Extract text from PDF with native text
The system SHALL extract text content from PDF files using pdfjs-dist for format detection purposes.

#### Scenario: Extract text for format detection
- **WHEN** a PDF file is provided
- **THEN** the service SHALL return a string containing text from the **first 2000 characters only**
- **AND** the text SHALL be used for format-family-detection
- **AND** full text extraction is no longer required for quote analysis

#### Scenario: Extract text with page references
- **WHEN** text is extracted from a multi-page PDF
- **THEN** each page's text SHALL include its page number in the metadata
- **AND** this is retained for citation purposes in fallback mode

### Requirement: Clean extracted text formatting
The system SHALL remove common PDF artifacts from extracted text.

#### Scenario: Remove page numbers
- **WHEN** extracted text contains isolated page numbers
- **THEN** the service SHALL filter out lines that are only numbers

#### Scenario: Normalize whitespace
- **WHEN** extracted text contains multiple consecutive whitespace characters
- **THEN** the service SHALL normalize to single spaces while preserving paragraph breaks

### Requirement: Extract metadata from PDF
The system SHALL extract metadata from PDF files.

#### Scenario: Get page count
- **WHEN** a PDF is processed
- **THEN** the service SHALL return the total page count in the metadata
- **AND** this is used for complexity detection

### Requirement: Handle corrupted PDFs gracefully
The system SHALL handle corrupted or invalid PDF files.

#### Scenario: Invalid PDF file
- **WHEN** a file that is not a valid PDF is provided
- **THEN** the service SHALL throw an error with message "Invalid PDF file"

## ADDED Requirements

### Requirement: Fast extraction for format detection
The system SHALL extract only enough text for format detection.

#### Scenario: Quick extraction
- **WHEN** format detection is requested
- **THEN** the system SHALL extract only the first 2000 characters
- **AND** extraction SHALL complete in < 500ms
- **AND** no full document processing is required

#### Scenario: Full extraction for fallback
- **WHEN** multimodal extraction fails and fallback is needed
- **THEN** the system SHALL extract the full document text
- **AND** process all pages

## Dependencies
- `pdfjs-dist` for text extraction
- `format-family-detection` uses this service
