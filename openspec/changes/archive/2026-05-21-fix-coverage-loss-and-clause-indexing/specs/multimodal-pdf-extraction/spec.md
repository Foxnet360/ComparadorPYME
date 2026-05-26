# Spec: Multimodal PDF Extraction (Delta)

## MODIFIED Requirements

### Requirement: Schema V2 for flexible extraction
**Reason**: The current schema marks deductible as non-nullable with instruction "NEVER leave empty", causing valid coverages without explicit deductibles to be rejected or malformed.

The system SHALL use a flexible JSON schema that captures document structure without forcing 14 canonical coverages, and permits null deductibles.

#### Scenario: Extract all coverage types
- **WHEN** a PDF contains main coverages, sub-límites, and general deductibles
- **THEN** the schema SHALL capture:
  - insurerName, policyName, validityPeriod
  - premium breakdown (netPremium, fees, taxes, otherCharges, totalPayable)
  - insuredAssets array (assetType, value, notes)
  - rawCoverages array (rawName, insuredAmount, deductible, premium, notes)
  - subLimits array (parentCoverage, name, limit, deductible)
  - generalDeductibles array (appliesTo, deductibleText)
  - specialConditions, exclusions, warranties

#### Scenario: No invented values
- **WHEN** a coverage is not present in the PDF
- **THEN** the rawCoverages array SHALL NOT include an invented entry
- **AND** the coverage SHALL be handled as "missing" during post-processing

#### Scenario: Coverage with null deductible
- **WHEN** a PDF coverage has no deductible specified
- **THEN** the schema SHALL accept deductible: null
- **AND** the coverage SHALL be included in rawCoverages
- **AND** normalization SHALL attempt to apply a general deductible

#### Scenario: Coverage with explicit deductible
- **WHEN** a PDF coverage has a deductible specified
- **THEN** the schema SHALL accept the deductible string
- **AND** it SHALL be preserved through extraction and normalization

## ADDED Requirements

### Requirement: Deductible field is nullable in extraction schema
The rawCoverage deductible field SHALL be nullable to accommodate PDFs where deductibles are specified globally rather than per-coverage.

#### Scenario: Schema accepts null deductible
- **WHEN** Gemini returns a coverage with deductible: null
- **THEN** the schema validation SHALL accept it
- **AND** the coverage SHALL proceed to normalization
- **AND** a general deductible SHALL be applied if available

#### Scenario: Schema accepts string deductible
- **WHEN** Gemini returns a coverage with deductible: "10% sobre valor asegurado"
- **THEN** the schema validation SHALL accept it
- **AND** the string SHALL be preserved through normalization
