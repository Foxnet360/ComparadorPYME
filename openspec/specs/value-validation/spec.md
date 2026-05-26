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
---

## Delta from change: complete-system-audit-remediation

## MODIFIED Requirements

### Requirement: Validate extracted values against source text
The system SHALL verify that extracted coverage values exist in the raw source text before accepting them as factual. **ADDED**: The system SHALL also validate that parsed monetary values preserve decimal points in abbreviations.

#### Scenario: Decimal abbreviation preserved
- **WHEN** the raw text contains "1.5M" (1,500,000)
- **THEN** `parseCoverageValue` SHALL return 1,500,000
- **AND** SHALL NOT return 15,000,000

#### Scenario: Thousand separator handled
- **WHEN** the raw text contains "1.500.000" (Colombian format)
- **THEN** `parseCoverageValue` SHALL return 1,500,000
- **AND** SHALL correctly distinguish from decimal abbreviations

#### Scenario: Currency normalization
- **WHEN** a value is in USD (e.g., "$1,000")
- **AND** the analysis is in COP
- **THEN** the system SHALL normalize to COP before range validation
- **OR** SHALL skip range validation if currency conversion is unavailable

## ADDED Requirements

### Requirement: Externalize SMMLV/UVT Values
The system SHALL use configurable SMMLV and UVT values instead of hardcoded ones.

#### Scenario: Configurable values
- **WHEN** SMMLV changes (e.g., from 1,300,000 to 1,423,500)
- **THEN** updating the environment variable `SMMLV_VALUE` SHALL update all calculations
- **AND** no code changes SHALL be required

#### Scenario: Fallback values
- **WHEN** SMMLV_VALUE is not set
- **THEN** the system SHALL use a sensible default
- **AND** log a warning: "SMMLV_VALUE not set, using default: X"

### Requirement: Precise Financial Calculations
The system SHALL use decimal arithmetic for all monetary calculations.

#### Scenario: Price scoring precision
- **WHEN** calculating price scores with large values (billions of COP)
- **THEN** `decimal.js` SHALL be used
- **AND** floating point errors SHALL NOT occur

#### Scenario: Sum of prices
- **WHEN** summing multiple quote prices
- **THEN** the sum SHALL be exact
- **AND** SHALL NOT accumulate rounding errors
