# Spec: Quote Analysis V2

## Capability
Análisis de cotizaciones usando extracción multimodal de PDFs con Gemini 2.5 Pro, reemplazando la extracción de texto plano actual.

## User Story
**Como** usuario del comparador
**Quiero** analizar cotizaciones de seguros de forma confiable y rápida
**Para** obtener comparaciones precisas de primas, coberturas y deducibles

## MODIFIED Requirements

### Requirement: Text-based quote analysis
The system SHALL analyze insurance quotes using **multimodal PDF extraction** followed by post-normalization, instead of text-based extraction with deterministic parsing.

#### Scenario: Single quote analysis
- **WHEN** a user uploads a quote PDF
- **THEN** the system SHALL:
  1. Detect format family (format-family-detection)
  2. Upload PDF to Gemini File API (multimodal-pdf-extraction)
  3. Extract structured data with specialized prompt (multimodal-pdf-extraction)
  4. Normalize coverages to canonical categories (coverage-post-normalization)
  5. Return structured quote data with 14 canonical coverages
- **AND** processing time SHALL be < 5 minutes per quote

#### Scenario: Multiple quote comparison
- **WHEN** a user uploads 3-5 quote PDFs
- **THEN** the system SHALL process each quote **sequentially** (not in parallel)
- **AND** results SHALL be combined into a comparative analysis
- **AND** total processing time SHALL be < 5 minutes for all quotes
- **AND** scoring SHALL be based on canonical coverages with per-coverage premiums

#### Scenario: Quote with clauses cross-reference
- **WHEN** a quote is analyzed and clauses exist for that insurer
- **THEN** the system SHALL retrieve relevant clause sections via RAG **asynchronously**
- **AND** cross-reference deductibles and exclusions
- **AND** include discrepancies in the analysis
- **AND** RAG SHALL NOT block the main extraction pipeline

### Requirement: No forced JSON output
The system SHALL NOT force Gemini to output JSON for quote analysis **when using multimodal extraction**.

#### Scenario: Gemini call configuration
- **WHEN** the system calls Gemini for quote extraction
- **THEN** the call SHALL include responseSchema and responseMimeType: "application/json"
- **AND** Gemini SHALL generate structured JSON conforming to QuoteExtractionSchemaV2
- **AND** this is enforced by the schema, not by prompt text

### Requirement: Deterministic output
The system SHALL produce consistent, reproducible analysis results.

#### Scenario: Repeated analysis
- **WHEN** the same quote is analyzed twice
- **THEN** the extracted data SHALL be identical (assuming no prompt changes)
- **AND** the scoring SHALL be identical (rule-based)
- **AND** the narrative may vary slightly (Gemini text generation)

## REMOVED Requirements

### Requirement: Free-text extraction with regex parsing
**Reason**: Replaced by multimodal extraction with structured JSON schema
**Migration**: The deterministic parser (quoteParser.ts) is deprecated. Use the new coverage-post-normalization service instead.

### Requirement: Text extraction from PDF with structural markers
**Reason**: Multimodal extraction handles structure natively without text markers
**Migration**: PDFs are now uploaded directly to Gemini without intermediate text extraction for analysis.

## ADDED Requirements

### Requirement: Format-specific extraction
The system SHALL use specialized prompts based on detected format family.

#### Scenario: HDI extraction
- **WHEN** format family is TABLE-DOUBLE
- **THEN** the prompt SHALL instruct Gemini that deductibles are on a separate page
- **AND** the prompt SHALL ask to relate general deductibles to specific coverages

#### Scenario: CHUBB extraction
- **WHEN** format family is TABLE-INTEGRATED
- **THEN** the prompt SHALL instruct Gemini to extract sub-límites separately
- **AND** the prompt SHALL identify parent coverage for each sub-límite

#### Scenario: MAPFRE extraction
- **WHEN** format family is SECTIONS
- **THEN** the prompt SHALL instruct Gemini that each section contains multiple coverages
- **AND** the prompt SHALL ask to list all coverages included in each section

## Dependencies
- `multimodal-pdf-extraction` for PDF extraction
- `format-family-detection` for prompt selection
- `coverage-post-normalization` for canonical mapping
- `premium-breakdown-extraction` for prima analysis

---

## MODIFIED Requirements (from change: correccion-cotizacion-allianz)

### Requirement: Dynamic timeout based on coverage count
The fixed 2-minute timeout SHALL be replaced with a dynamic timeout.

#### Scenario: Timeout calculation
- **WHEN** a quote has N coverages
- **THEN** the timeout SHALL be: max(120, 30 + N × 3) seconds
- **AND** minimum timeout SHALL be 120 seconds (2 minutes)
- **AND** maximum timeout SHALL be 300 seconds (5 minutes)

#### Scenario: Small quote
- **WHEN** a quote has 5 coverages
- **THEN** timeout SHALL be 30 + 15 = 45 seconds
- **BUT** minimum applies: 120 seconds

#### Scenario: Large quote
- **WHEN** a quote has 50 coverages
- **THEN** timeout SHALL be 30 + 150 = 180 seconds (3 minutes)

#### Scenario: Very large quote
- **WHEN** a quote has 100 coverages
- **THEN** timeout SHALL be 30 + 300 = 330 seconds
- **BUT** maximum applies: 300 seconds (5 minutes)

#### Requirement: Graceful degradation on timeout
The system SHALL continue processing remaining quotes if one times out.

##### Scenario: One quote times out
- **WHEN** quote 2 of 3 times out
- **THEN** the system SHALL:
  1. Log the timeout error
  2. Mark quote 2 as "failed: timeout"
  3. Continue processing quote 3
  4. Include partial results in the final analysis
  5. Show a warning to the user: "Análisis incompleto: cotización X no pudo procesarse por timeout"

##### Scenario: All quotes process successfully
- **WHEN** all quotes complete within their timeouts
- **THEN** the system SHALL show full comparison as before

#### Requirement: Updated processing time target
The total processing time requirement SHALL account for large quotes.

##### Scenario: 3 quotes with 20 coverages each
- **WHEN** processing 3 large quotes
- **THEN** total time SHALL be < 15 minutes
- **AND** individual quote timeout SHALL be ~3 minutes each
- **AND** the system SHALL NOT fail the entire analysis

## ADDED Requirements (from change: correccion-cotizacion-allianz)

### Requirement: Support for CONDITIONS format
The system SHALL support quotes in CONDITIONS format.

#### Scenario: Allianz quote analysis
- **WHEN** format family is CONDITIONS
- **THEN** the system SHALL use the CONDITIONS-specific prompt
- **AND** extract coverages from narrative text
- **AND** handle missing individual insured amounts
- **AND** look for deductibles in the conditions text

### Requirement: Partial results handling
The system SHALL generate comparison even with partial results.

#### Scenario: One quote failed
- **WHEN** 2 of 3 quotes succeed
- **THEN** the system SHALL generate comparison for the 2 successful quotes
- **AND** mark the failed quote as "No disponible" in the comparison table
- **AND** include a note explaining the failure

---

## Delta from change: correccion-cotizacion-allianz

# Spec: Quote Analysis V2 (Delta)

## Delta for: quote-analysis-v2

## Changes

### MODIFIED Requirements

#### Requirement: Dynamic timeout based on coverage count
The fixed 2-minute timeout SHALL be replaced with a dynamic timeout.

##### Scenario: Timeout calculation
- **WHEN** a quote has N coverages
- **THEN** the timeout SHALL be: max(120, 30 + N × 3) seconds
- **AND** minimum timeout SHALL be 120 seconds (2 minutes)
- **AND** maximum timeout SHALL be 300 seconds (5 minutes)

##### Scenario: Small quote
- **WHEN** a quote has 5 coverages
- **THEN** timeout SHALL be 30 + 15 = 45 seconds
- **BUT** minimum applies: 120 seconds

##### Scenario: Large quote
- **WHEN** a quote has 50 coverages
- **THEN** timeout SHALL be 30 + 150 = 180 seconds (3 minutes)

##### Scenario: Very large quote
- **WHEN** a quote has 100 coverages
- **THEN** timeout SHALL be 30 + 300 = 330 seconds
- **BUT** maximum applies: 300 seconds (5 minutes)

#### Requirement: Graceful degradation on timeout
The system SHALL continue processing remaining quotes if one times out.

##### Scenario: One quote times out
- **WHEN** quote 2 of 3 times out
- **THEN** the system SHALL:
  1. Log the timeout error
  2. Mark quote 2 as "failed: timeout"
  3. Continue processing quote 3
  4. Include partial results in the final analysis
  5. Show a warning to the user: "Análisis incompleto: cotización X no pudo procesarse por timeout"

##### Scenario: All quotes process successfully
- **WHEN** all quotes complete within their timeouts
- **THEN** the system SHALL show full comparison as before

#### Requirement: Updated processing time target
The total processing time requirement SHALL account for large quotes.

##### Scenario: 3 quotes with 20 coverages each
- **WHEN** processing 3 large quotes
- **THEN** total time SHALL be < 15 minutes
- **AND** individual quote timeout SHALL be ~3 minutes each
- **AND** the system SHALL NOT fail the entire analysis

### ADDED Requirements

#### Requirement: Support for CONDITIONS format
The system SHALL support quotes in CONDITIONS format.

##### Scenario: Allianz quote analysis
- **WHEN** format family is CONDITIONS
- **THEN** the system SHALL use the CONDITIONS-specific prompt
- **AND** extract coverages from narrative text
- **AND** handle missing individual insured amounts
- **AND** look for deductibles in the conditions text

#### Requirement: Partial results handling
The system SHALL generate comparison even with partial results.

##### Scenario: One quote failed
- **WHEN** 2 of 3 quotes succeed
- **THEN** the system SHALL generate comparison for the 2 successful quotes
- **AND** mark the failed quote as "No disponible" in the comparison table
- **AND** include a note explaining the failure

## Dependencies
- `quote-extraction-conditions-format` for CONDITIONS format support
- `format-family-detection` for format classification

---

## Delta from change: complete-system-audit-remediation

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
