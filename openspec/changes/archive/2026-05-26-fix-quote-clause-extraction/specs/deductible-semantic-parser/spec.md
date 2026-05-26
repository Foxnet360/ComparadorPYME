## MODIFIED Requirements

### Requirement: Parse compound deductible structures using Structured Outputs
The system SHALL parse complex deductible expressions including percentages, minimums, maximums, and fixed amounts using Gemini Structured Outputs with a JSON schema.

#### Scenario: Parse compound deductible with responseSchema
- **WHEN** a complex deductible text like "10% con mínimo de 5 SMMLV" is evaluated
- **THEN** the system SHALL invoke Gemini with responseSchema and responseMimeType: "application/json"
- **AND** the extracted components and semantics SHALL conform precisely to the schema
