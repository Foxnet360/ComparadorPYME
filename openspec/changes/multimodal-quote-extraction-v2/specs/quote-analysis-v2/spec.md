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
