## MODIFIED Requirements

### Requirement: Creación de chunks semánticos con tamaño ampliado
The system SHALL chunk document texts using a target size of 2500-3000 characters and include overlap to preserve legal context in policy wording files.

#### Scenario: Create large semantic chunks
- **WHEN** pages of a policy wording (clausulado) are processed
- **THEN** the system SHALL create chunks of 2500-3000 characters
- **AND** apply a 15% overlap between adjacent chunks
- **AND** preserve the page metadata for each chunk

### Requirement: OCR fallback for scanned clausulados
The system SHALL use Gemini 3.5 Flash vision capability as an OCR fallback to extract structured text when the raw text extracted from a page is empty or too short.

#### Scenario: Transcribe scanned page
- **WHEN** a page text length is less than 200 characters
- **THEN** the system SHALL send the page image to Gemini 3.5 Flash
- **AND** use the transcribed text to generate semantic chunks
