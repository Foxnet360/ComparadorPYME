# Spec: Coverage Post-Normalization (Delta)

## MODIFIED Requirements

### Requirement: Build final canonical coverage array
**Reason**: Current implementation filters out uncategorized coverages without insuredAmount or premium, causing data loss.

The system SHALL produce an array of exactly 14 canonical coverages with statuses, PLUS uncategorized coverages without value-based filtering.

#### Scenario: Present coverage
- **WHEN** a canonical coverage is found (explicit or implicit)
- **THEN** status SHALL be "present"
- **AND** include insuredAmount, deductible, premium, confidence

#### Scenario: Missing coverage
- **WHEN** a canonical coverage is not found in the quote
- **THEN** status SHALL be "missing"
- **AND** all other fields SHALL be null

#### Scenario: Uncategorized coverage with value
- **WHEN** a raw coverage does not map to any canonical category
- **AND** it has insuredAmount or premium
- **THEN** it SHALL appear in uncategorizedCoverages
- **AND** status SHALL be "present"
- **AND** matchMethod SHALL be "semantic-group"

#### Scenario: Uncategorized coverage without value
- **WHEN** a raw coverage does not map to any canonical category
- **AND** it has no insuredAmount and no premium
- **THEN** it SHALL still appear in uncategorizedCoverages
- **AND** status SHALL be "present"
- **AND** confidence SHALL be 0
- **AND** needsReview SHALL be true
- **AND** a warning SHALL be logged

## ADDED Requirements

### Requirement: Preserve uncategorized coverages regardless of value
The system SHALL include all raw coverages that fail canonical mapping in the uncategorizedCoverages array, without filtering by insuredAmount or premium.

#### Scenario: Coverage with only name
- **WHEN** a raw coverage has only a name (no amount, no premium, no deductible)
- **THEN** it SHALL be added to uncategorizedCoverages
- **AND** name SHALL be the raw name
- **AND** all other fields SHALL be null
- **AND** needsReview SHALL be true
- **AND** a note SHALL indicate "Cobertura sin valor ni prima especificados"
