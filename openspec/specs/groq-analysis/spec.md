# Groq Analysis

## ADDED Requirements

### Requirement: Analyze quotes using Groq LLM with RAG context
The system SHALL use Groq (Llama 3.1) to analyze insurance quotes with context from retrieved clause chunks.

#### Scenario: Generate analysis with RAG context
- **WHEN** a quote is analyzed with retrieved clause chunks
- **THEN** the prompt SHALL include the quote content plus relevant clause excerpts as context

#### Scenario: Extract structured JSON output
- **THEN** the LLM SHALL return structured JSON with: insurerName, coverages[], deductibles[], price, score, alerts[], recommendation

### Requirement: Generate citations in analysis output
The system SHALL include citations referencing specific clause chunks in the analysis output.

#### Scenario: Include clause references
- **WHEN** the LLM mentions a specific exclusion or condition
- **THEN** the output SHALL include a reference to the source chunk with section and page number

### Requirement: Handle LLM API errors gracefully
The system SHALL handle Groq API errors with appropriate fallback and error messages.

#### Scenario: Rate limit exceeded
- **WHEN** Groq returns a rate limit error
- **THEN** the system SHALL wait and retry up to 3 times with exponential backoff

#### Scenario: Invalid JSON response
- **WHEN** LLM response cannot be parsed as JSON
- **THEN** the system SHALL attempt to extract JSON from the response, or return error with raw response

### Requirement: Support quote extraction from PDF text
The system SHALL extract structured quote data from raw PDF text before analysis.

#### Scenario: Parse coverage information
- **WHEN** raw quote text is provided
- **THEN** the system SHALL extract: insurer_name, coverage_name, coverage_limit, coverage_premium, deductible

#### Scenario: Handle malformed quotes
- **WHEN** quote text cannot be parsed
- **THEN** the system SHALL pass the raw text to LLM for interpretation

### Requirement: Configure LLM parameters
The system SHALL support configurable LLM parameters for temperature, max tokens, and model selection.

#### Scenario: Use default parameters
- **WHEN** no parameters are specified
- **THEN** the system SHALL use: model=llama-3.1-70b-versatile, temperature=0.1, max_tokens=4000
