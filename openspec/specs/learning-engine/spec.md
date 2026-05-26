## ADDED Requirements

### Requirement: Capture user corrections
The system SHALL provide an interface for users to correct system mappings and extractions.

#### Scenario: User corrects coverage mapping
- **WHEN" a user sees "AMPARO BASICO" mapped to "Incendio"
- **AND** the user corrects it to "Todo Riesgo Compuesto"
- **THEN** the system stores this correction
- **AND" uses it for future mappings of the same raw name

### Requirement: Update thesaurus from corrections
The system SHALL automatically update the thesaurus when users make corrections.

#### Scenario: Thesaurus update
- **WHEN" a user corrects a mapping
- **THEN** the system adds the raw name as a synonym for the corrected category
- **AND" increments a correction count for that mapping
- **AND" uses the corrected mapping with higher priority in future

### Requirement: Retrain embeddings from feedback
The system SHALL periodically update coverage embeddings based on accumulated user corrections.

#### Scenario: Embedding update
- **WHEN** 10+ corrections accumulate for a coverage type
- **THEN** the system generates new embeddings that reflect corrected mappings
- **AND" validates them against held-out test corrections

### Requirement: Track correction effectiveness
The system SHALL measure whether corrections improve future extraction accuracy.

#### Scenario: Measure improvement
- **WHEN** a correction is applied
- **THEN** the system tracks:
  - How many future extractions use the corrected mapping
  - Whether those extractions require further correction
  - Overall correction rate trend over time
- **AND" reports accuracy improvements monthly

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Capture user corrections
The system SHALL provide an interface for users to correct system mappings and extractions.

#### Scenario: User corrects coverage mapping
- **WHEN" a user sees "AMPARO BASICO" mapped to "Incendio"
- **AND** the user corrects it to "Todo Riesgo Compuesto"
- **THEN** the system stores this correction
- **AND" uses it for future mappings of the same raw name

### Requirement: Update thesaurus from corrections
The system SHALL automatically update the thesaurus when users make corrections.

#### Scenario: Thesaurus update
- **WHEN" a user corrects a mapping
- **THEN** the system adds the raw name as a synonym for the corrected category
- **AND" increments a correction count for that mapping
- **AND" uses the corrected mapping with higher priority in future

### Requirement: Retrain embeddings from feedback
The system SHALL periodically update coverage embeddings based on accumulated user corrections.

#### Scenario: Embedding update
- **WHEN** 10+ corrections accumulate for a coverage type
- **THEN** the system generates new embeddings that reflect corrected mappings
- **AND" validates them against held-out test corrections

### Requirement: Track correction effectiveness
The system SHALL measure whether corrections improve future extraction accuracy.

#### Scenario: Measure improvement
- **WHEN** a correction is applied
- **THEN** the system tracks:
  - How many future extractions use the corrected mapping
  - Whether those extractions require further correction
  - Overall correction rate trend over time
- **AND" reports accuracy improvements monthly
