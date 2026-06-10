# Spec: Zod Extraction Validation

## Capability
Runtime validation and normalization of LLM extraction outputs using Zod schemas before persistence.

## Requirements

### Requirement: Validate LLM Outputs
All Gemini extraction outputs MUST pass Zod validation before persistence.

#### Scenario: Valid Pass
- **WHEN** a valid JSON extraction result is produced by Gemini
- **THEN** Zod validation accepts the data
- **AND** the data is persisted.

#### Scenario: Invalid Reject
- **WHEN** an extraction result contains invalid data (e.g., negative premium)
- **THEN** Zod rejects the output
- **AND** a logged retry is triggered.

### Requirement: Currency Normalization
SMMLV/UVT values MUST normalize to COP using configurable rates.

#### Scenario: Currency Normalization
- **WHEN** the text "5 SMMLV" is extracted
- **THEN** it is normalized to 6,500,000 COP using the current rate.

### Requirement: Graceful Degradation
Validation failures SHOULD trigger retry logic, not a crash.

#### Scenario: Retry on Validation Failure
- **WHEN** Zod validation fails on the first attempt
- **THEN** the system retries up to a configured maximum
- **AND** if all retries fail, returns a safe fallback rather than crashing.
