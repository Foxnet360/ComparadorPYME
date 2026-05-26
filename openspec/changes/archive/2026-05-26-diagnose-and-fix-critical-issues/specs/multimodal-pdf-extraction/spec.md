## MODIFIED Requirements

### Requirement: Extract data using multimodal generation
The system SHALL send the uploaded PDF to Gemini with a specialized prompt and receive structured JSON output, with improved error handling and graceful degradation.

#### Scenario: Multimodal extraction with schema
- **WHEN** a PDF is uploaded and active
- **THEN** the system SHALL call model.generateContent() with:
  - The specialized prompt as text
  - The PDF file as fileData (fileUri + mimeType)
  - responseMimeType: "application/json"
  - responseSchema: QuoteExtractionSchemaV2
- **AND** Gemini SHALL analyze the visual structure of the PDF
- **AND** the response SHALL conform to the JSON schema

#### Scenario: Handle Gemini extraction failure with categorization
- **WHEN** Gemini returns an error or invalid JSON
- **THEN** the system SHALL categorize the error:
  - 429 → GeminiRateLimitError
  - 503 → GeminiServiceUnavailableError
  - timeout → GeminiTimeoutError
  - other → GeminiUnknownError
- **AND** the system SHALL retry up to 3 times with exponential backoff for 503 errors only
- **AND** if all retries fail, the system SHALL throw the categorized error
- **AND** the error SHALL be logged with the quote filename and request ID

#### Scenario: Graceful degradation on extraction failure
- **WHEN** multimodal extraction fails after retries
- **THEN** the system SHALL attempt fallback to legacy text-based extraction
- **AND** if fallback succeeds, the result SHALL be marked with `extractionMethod: "legacy-fallback"`
- **AND** if fallback also fails, the quote SHALL be marked as failed with `isFailed: true`
- **AND** processing SHALL continue with remaining quotes

#### Scenario: Preserve table structure
- **WHEN** a PDF contains tables with coberturas, sumas aseguradas, and deducibles
- **THEN** Gemini SHALL extract each row as a separate coverage entry
- **AND** the spatial relationship between columns SHALL be preserved
- **AND** merged cells or spanning rows SHALL be handled correctly

### Requirement: Upload PDF to Gemini File API
The system SHALL upload PDF files to Google Gemini File API before extraction.

#### Scenario: Upload valid PDF
- **WHEN** a quote PDF file is provided for extraction
- **THEN** the system SHALL upload the file using GoogleAIFileManager.uploadFile()
- **AND** the mimeType SHALL be "application/pdf"
- **AND** the system SHALL wait until file.state === FileState.ACTIVE

#### Scenario: Handle upload failure
- **WHEN** a PDF upload fails (network error, invalid file, size exceeded)
- **THEN** the system SHALL throw a categorized error
- **AND** the extraction SHALL be aborted for this quote
- **AND** processing SHALL continue with remaining quotes

#### Scenario: Handle large PDFs
- **WHEN** a PDF exceeds 20MB
- **THEN** the system SHALL reject the file with error "PDF exceeds maximum size of 20MB"
- **AND** no upload SHALL be attempted
- **AND** the quote SHALL be marked as failed

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

## ADDED Requirements

### Requirement: Extraction timeout handling
The system SHALL enforce a maximum execution time for PDF extraction and handle timeouts gracefully.

#### Scenario: Extraction within timeout
- **WHEN** a PDF extraction completes within 5 minutes
- **THEN** the result SHALL be processed normally

#### Scenario: Extraction exceeds timeout
- **WHEN** a PDF extraction exceeds 5 minutes
- **THEN** the operation SHALL be cancelled
- **AND** a GeminiTimeoutError SHALL be thrown
- **AND** the quote SHALL be marked as failed
- **AND** the uploaded file SHALL be cleaned up

### Requirement: Concurrent extraction limit
The system SHALL limit the number of simultaneous extractions to prevent overwhelming Gemini API.

#### Scenario: Process multiple quotes with concurrency limit
- **WHEN** a user uploads more than 2 quotes
- **THEN** the system SHALL process them in batches of maximum 2 concurrent extractions
- **AND** remaining quotes SHALL wait in a queue
- **AND** if one quote in a batch fails, the other SHALL continue processing
