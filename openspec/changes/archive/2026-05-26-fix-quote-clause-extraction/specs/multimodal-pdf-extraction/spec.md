## MODIFIED Requirements

### Requirement: Extract data using multimodal generation
The system SHALL send the uploaded PDF to Gemini 3.5 Flash with a specialized prompt and receive structured JSON output.

#### Scenario: Multimodal extraction with schema
- **WHEN** a PDF is uploaded and active
- **THEN** the system SHALL call model.generateContent() with:
  - The specialized prompt as text
  - The PDF file as fileData (fileUri + mimeType)
  - responseMimeType: "application/json"
  - responseSchema: QuoteExtractionSchemaV2
- **AND** Gemini SHALL analyze the visual structure of the PDF
- **AND** the response SHALL conform to the JSON schema
- **AND** the model utilized SHALL be Gemini 3.5 Flash

#### Scenario: Handle Gemini extraction failure
- **WHEN** Gemini returns an error or invalid JSON
- **THEN** the system SHALL retry up to 3 times with exponential backoff
- **AND** if all retries fail, the system SHALL throw an error with the original failure reason
- **AND** the error SHALL be logged with the quote filename

#### Scenario: Preserve table structure
- **WHEN** a PDF contains tables with coberturas, sumas aseguradas, and deducibles
- **THEN** Gemini SHALL extract each row as a separate coverage entry
- **AND** the spatial relationship between columns SHALL be preserved
- **AND** merged cells or spanning rows SHALL be handled correctly
