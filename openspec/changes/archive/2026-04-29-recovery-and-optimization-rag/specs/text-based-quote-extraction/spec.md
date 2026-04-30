## ADDED Requirements

### Requirement: Text-based quote extraction from Gemini
The system SHALL extract structured quote data from insurance PDFs using free-text prompts to Gemini, without forcing JSON schema output.

#### Scenario: Single quote extraction
- **WHEN** a user uploads a single insurance quote PDF
- **THEN** the system sends the extracted text to Gemini with a free-text prompt
- **AND** Gemini responds with structured text using === markers
- **AND** the system parses the response using deterministic local regex

#### Scenario: Multiple quote extraction
- **WHEN** a user uploads 3-5 insurance quote PDFs simultaneously
- **THEN** the system processes each quote individually (one Gemini call per quote)
- **AND** results are combined into a single analysis
- **AND** total processing time is under 10 seconds

#### Scenario: Quote with missing data
- **WHEN** a quote PDF is missing coverage details or deductibles
- **THEN** the system marks those fields as "NO ESPECIFICADO"
- **AND** continues processing without failing

### Requirement: No forced JSON schema
The system SHALL NOT use `responseSchema` or `responseMimeType: "application/json"` when calling Gemini for quote extraction.

#### Scenario: Gemini configuration
- **WHEN** the system calls Gemini for quote extraction
- **THEN** the generationConfig contains NO responseSchema property
- **AND** the generationConfig contains NO responseMimeType property
- **AND** Gemini generates free text with structural markers

### Requirement: Parallel quote processing
The system SHALL process multiple quotes concurrently when API rate limits permit.

#### Scenario: Concurrent processing
- **WHEN** 3 quotes are submitted for analysis
- **THEN** the system sends up to 3 concurrent requests to Gemini
- **AND** results are collected and combined after all complete
- **AND** if rate limited, requests are queued with exponential backoff