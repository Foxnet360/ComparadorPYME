## MODIFIED Requirements

### Requirement: Capture user corrections
The system SHALL provide an interface for users to correct system mappings and extractions.

#### Scenario: User corrects coverage mapping
- **WHEN** a user corrects a coverage mapping or deductible in the comparison grid
- **THEN** the system SHALL store this correction in the database
- **AND** include the raw name, insurer name, original system mapping, corrected category, exact text evidence snippet, and calculated source page
- **AND** invalidate affected cache entries immediately for real-time application

## ADDED Requirements

### Requirement: Dynamic In-Context Few-Shot Learning
The system SHALL retrieve historical human corrections and inject them as few-shot examples in subsequent LLM classification calls.

#### Scenario: Dynamic examples injected in classifier
- **WHEN** the system runs the semantic classification for a new coverage
- **THEN** the system SHALL execute a vector search for the top 3 most similar past human corrections
- **AND** inject these as dynamic few-shot examples into the Gemini prompt
- **AND** the model SHALL prioritize these historical human criteria for classification
