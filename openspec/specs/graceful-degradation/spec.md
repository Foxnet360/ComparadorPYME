# Spec: Graceful Degradation

## Purpose
El sistema debe continuar procesando cotizaciones restantes cuando una extracción individual falla, y representar las cotizaciones fallidas en la respuesta con información suficiente para que el usuario entienda qué ocurrió.

## ADDED Requirements

### Requirement: Continue processing on individual quote failures
The system SHALL continue processing remaining quotes when an individual quote extraction fails, rather than failing the entire analysis.

#### Scenario: One quote fails, others succeed
- **WHEN** a user uploads 3 quote PDFs for analysis
- **AND** the second quote fails to extract (e.g., Gemini 503 error)
- **THEN** the system SHALL process the first and third quotes successfully
- **AND** the final report SHALL include results for all 3 quotes
- **AND** the failed quote SHALL be marked with an error state

#### Scenario: All quotes fail
- **WHEN** a user uploads quotes for analysis
- **AND** all quotes fail to extract
- **THEN** the system SHALL return a response with all quotes in error state
- **AND** the response SHALL include a clear message explaining that no quotes could be processed
- **AND** the HTTP status SHALL still be 200 (request was valid, but processing failed)

### Requirement: Failed quote representation
The system SHALL represent failed quotes in the response with enough information for the user to understand what happened.

#### Scenario: Failed quote in response
- **WHEN** a quote fails during extraction
- **THEN** the response for that quote SHALL include:
  - `insurerName`: the filename or detected insurer
  - `policyName`: "Error en procesamiento"
  - `priceAnnual`: 0
  - `coverages`: empty array
  - `specialConditions`: array with the error message
  - `parseConfidence`: 0
  - `isFailed`: true
  - `errorCategory`: the categorized error type

### Requirement: Graceful feature degradation
The system SHALL disable features that depend on unavailable services rather than failing.

#### Scenario: Redis unavailable
- **WHEN** the learning engine feature is enabled
- **AND** Redis is not configured or unreachable
- **THEN** the system SHALL automatically disable the learning engine
- **AND** it SHALL log a warning that the feature was disabled due to missing Redis
- **AND** the rest of the analysis SHALL continue normally

#### Scenario: Optional service timeout
- **WHEN** an optional service (e.g., RAG clause retrieval) times out
- **THEN** the system SHALL skip that step
- **AND** it SHALL mark the result as having incomplete RAG data
- **AND** the scoring SHALL adjust to not penalize for missing optional validation
