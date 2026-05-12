# Spec: Multimodal PDF Extraction

## Capability
Extracción de datos de cotizaciones de seguros mediante visión multimodal de documentos PDF usando Gemini 2.5 Pro con File API, preservando la estructura tabular y espacial del documento original.

## User Story
**Como** sistema de análisis de cotizaciones
**Quiero** procesar PDFs directamente con visión de IA
**Para** extraer datos estructurados preservando tablas, secciones y relaciones espaciales entre coberturas, valores y deducibles

## ADDED Requirements

### Requirement: Upload PDF to Gemini File API
The system SHALL upload PDF files to Google Gemini File API before extraction.

#### Scenario: Upload valid PDF
- **WHEN** a quote PDF file is provided for extraction
- **THEN** the system SHALL upload the file using GoogleAIFileManager.uploadFile()
- **AND** the mimeType SHALL be "application/pdf"
- **AND** the system SHALL wait until file.state === FileState.ACTIVE

#### Scenario: Handle upload failure
- **WHEN** a PDF upload fails (network error, invalid file, size exceeded)
- **THEN** the system SHALL throw an error with message "Failed to upload PDF: {reason}"
- **AND** the extraction SHALL be aborted

#### Scenario: Handle large PDFs
- **WHEN** a PDF exceeds 20MB
- **THEN** the system SHALL reject the file with error "PDF exceeds maximum size of 20MB"
- **AND** no upload SHALL be attempted

### Requirement: Extract data using multimodal generation
The system SHALL send the uploaded PDF to Gemini 2.5 Pro with a specialized prompt and receive structured JSON output.

#### Scenario: Multimodal extraction with schema
- **WHEN** a PDF is uploaded and active
- **THEN** the system SHALL call model.generateContent() with:
  - The specialized prompt as text
  - The PDF file as fileData (fileUri + mimeType)
  - responseMimeType: "application/json"
  - responseSchema: QuoteExtractionSchemaV2
- **AND** Gemini SHALL analyze the visual structure of the PDF
- **AND** the response SHALL conform to the JSON schema

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

### Requirement: Schema V2 for flexible extraction
The system SHALL use a flexible JSON schema that captures document structure without forcing 14 canonical coverages.

#### Scenario: Extract all coverage types
- **WHEN** a PDF contains main coverages, sub-límites, and general deductibles
- **THEN** the schema SHALL capture:
  - insurerName, policyName, validityPeriod
  - premium breakdown (netPremium, fees, taxes, otherCharges, totalPayable)
  - insuredAssets array (assetType, value, notes)
  - rawCoverages array (rawName, insuredAmount, deductible, premium, notes)
  - subLimits array (parentCoverage, name, limit, deductible)
  - generalDeductibles array (appliesTo, deductibleText)
  - specialConditions, exclusions, warranties

#### Scenario: No invented values
- **WHEN** a coverage is not present in the PDF
- **THEN** the rawCoverages array SHALL NOT include an invented entry
- **AND** the coverage SHALL be handled as "missing" during post-processing

#### Scenario: Handle sub-límites
- **WHEN** a PDF contains sub-límites (e.g., "Remoción de escombros (Sublímite)")
- **THEN** they SHALL be placed in the subLimits array
- **AND** parentCoverage SHALL reference the main coverage they belong to

#### Scenario: Handle premium breakdowns
- **WHEN** a PDF desgloses prima into multiple components
- **THEN** all components SHALL be captured in premium object
- **AND** totalPayable SHALL equal the sum shown in the document

### Requirement: Cleanup uploaded files
The system SHALL delete uploaded files from Gemini File API after extraction.

#### Scenario: Successful cleanup
- **WHEN** extraction completes successfully
- **THEN** the uploaded file SHALL be deleted using fileManager.deleteFile()
- **AND** deletion errors SHALL be logged but not fail the extraction

#### Scenario: Cleanup after failure
- **WHEN** extraction fails at any stage
- **THEN** cleanup SHALL still be attempted
- **AND** any uploaded file SHALL be removed to avoid storage accumulation

## MODIFIED Requirements

### Requirement: Deductible field is mandatory
**Reason**: Previous schema allowed null deductibles causing "NO ESPECIFICADO" fallback

#### Scenario: Deductible must be extracted
- **WHEN** the schema defines the deductible field
- **THEN** it SHALL NOT be nullable
- **AND** the description SHALL instruct: "Extract deductible for this coverage. If no deductible applies, use 'No aplica'. If not found in main table, search all pages including clauses and conditions."

#### Scenario: Multi-page deductible search
- **WHEN** a PDF has deductibles on page 2+ (e.g., HDI format)
- **THEN** the prompt SHALL explicitly instruct Gemini to review ALL pages
- **AND** the prompt SHALL mention: "Deductibles may be in a separate table, clauses section, or conditions page"

## REMOVED Requirements

### Requirement: Text-based extraction
**Reason**: Replaced by multimodal PDF extraction for better accuracy with tables
**Migration**: Use multimodal extraction for all new quote processing. Text extraction remains as fallback for edge cases.
