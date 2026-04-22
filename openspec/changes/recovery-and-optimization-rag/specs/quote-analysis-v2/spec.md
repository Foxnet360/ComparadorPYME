## ADDED Requirements

### Requirement: Text-based quote analysis
The system SHALL analyze insurance quotes using text-based extraction from Gemini followed by local deterministic parsing.

#### Scenario: Single quote analysis
- **WHEN** a user uploads a quote PDF
- **THEN** the system extracts text from the PDF
- **AND** sends it to Gemini with a free-text prompt
- **AND** parses the response using regex and thesaurus normalization
- **AND** returns structured quote data

#### Scenario: Multiple quote comparison
- **WHEN** a user uploads 3-5 quote PDFs
- **THEN** the system processes each quote individually
- **AND** combines results into a comparative analysis
- **AND** generates scoring and narrative

#### Scenario: Quote with clauses cross-reference
- **WHEN** a quote is analyzed and clauses exist for that insurer
- **THEN** the system retrieves relevant clause sections via RAG
- **AND** cross-references deductibles and exclusions
- **AND** includes discrepancies in the analysis

### Requirement: No forced JSON output
The system SHALL NOT force Gemini to output JSON for quote analysis.

#### Scenario: Gemini call configuration
- **WHEN** the system calls Gemini for quote extraction
- **THEN** the call does NOT include responseSchema
- **AND** does NOT include responseMimeType: "application/json"
- **AND** Gemini generates free text with structural markers

### Requirement: Deterministic output
The system SHALL produce consistent, reproducible analysis results.

#### Scenario: Repeated analysis
- **WHEN** the same quote is analyzed twice
- **THEN** the extracted data is identical (assuming no prompt changes)
- **AND** the scoring is identical (rule-based)
- **AND** only the narrative may vary slightly (Gemini text generation)