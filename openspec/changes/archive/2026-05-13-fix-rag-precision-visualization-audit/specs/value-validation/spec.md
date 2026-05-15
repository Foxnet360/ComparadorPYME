## ADDED Requirements

### Requirement: Validate extracted values against source text
The system SHALL verify that extracted coverage values exist in the raw source text before accepting them as factual.

#### Scenario: Value found in source
- **WHEN** Gemini extracts value "$500.000.000" for Incendio
- **AND** the raw PDF text contains "500.000.000" or "$500M"
- **THEN** the value is marked with `source: 'extracted'`
- **AND** displayed normally in the coverage matrix

#### Scenario: Value not found in source
- **WHEN** Gemini extracts value "$10.000.000" for Incendio
- **AND** the raw PDF text does not contain "10.000.000", "$10M", or similar variants
- **THEN** the value is marked with `source: 'calculated'`
- **AND** displayed with an indicator icon (calculator symbol) in the matrix
- **AND** a tooltip explains: "Valor calculado o inferido, no encontrado literalmente en el documento"

#### Scenario: Inferred value from percentage
- **WHEN** the document states "10% sobre valor asegurado" and the insured value is $500M
- **AND** Gemini calculates $50M as the deductible
- **THEN** the value is marked with `source: 'inferred'`
- **AND** the tooltip explains: "Valor derivado de cálculo basado en el documento"

### Requirement: Consistency check via dual extraction
The system SHALL perform extraction twice for critical coverages and flag discrepancies.

#### Scenario: Consistent extraction
- **WHEN** extracting Incendio value twice yields "$500.000.000" both times
- **THEN** the value is accepted with high confidence

#### Scenario: Inconsistent extraction
- **WHEN** first extraction yields "$500.000.000" and second yields "$50.000.000"
- **THEN** the system flags the coverage for manual review
- **AND** displays a warning icon in the matrix
