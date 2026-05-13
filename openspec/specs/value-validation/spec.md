# Spec: Value Validation

## Capability
Validation of extracted coverage values against raw source text to detect hallucinations, with source tracking (extracted/calculated/inferred).

## User Story
**Como** corredor de seguros
**Quiero** saber si los valores extraídos están realmente en el documento
**Para** evitar decisiones basadas en datos incorrectos

## Functional Requirements

### FR-1: Validate extracted values against source text
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

### FR-2: Consistency check via dual extraction
The system SHALL perform extraction twice for critical coverages and flag discrepancies.

#### Scenario: Consistent extraction
- **WHEN** extracting Incendio value twice yields "$500.000.000" both times
- **THEN** the value is accepted with high confidence

#### Scenario: Inconsistent extraction
- **WHEN** first extraction yields "$500.000.000" and second yields "$50.000.000"
- **THEN** the system flags the coverage for manual review
- **AND** displays a warning icon in the matrix

### FR-3: Integration with scoring
The system SHALL consider value validation results in the overall analysis confidence.

#### Scenario: High validation confidence
- **WHEN** 90% of values are marked as 'extracted'
- **THEN** extraction confidence score is high (85-100)

#### Scenario: Low validation confidence
- **WHEN** 50% of values are marked as 'calculated' or 'inferred'
- **THEN** extraction confidence score is low (30-50)
- **AND** a warning is displayed: "Revisar valores extraídos - posibles alucinaciones"

## Dependencies
- Quote parser service
- Raw text storage
- Coverage matrix UI