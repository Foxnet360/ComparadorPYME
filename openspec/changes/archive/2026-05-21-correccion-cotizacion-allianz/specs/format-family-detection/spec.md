# Spec: Format Family Detection (Delta)

## Delta for: format-family-detection

## Changes

### ADDED Requirements

#### Requirement: Detect CONDITIONS format family
The system SHALL detect the "CONDITIONS" format family for Allianz-style documents.

##### Scenario: Allianz conditions document
- **WHEN** extracted text contains "COBERTURA BÁSICA" AND "COBERTURAS ESPECIFICAS Y LIMITES" AND section numbers like "8." or "9."
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 90%
- **AND** set hasSections to true

##### Scenario: General conditions format
- **WHEN** extracted text contains narrative descriptions of coverages with bullet points AND "condiciones del contrato" OR "condiciones particulares"
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 85%

### MODIFIED Requirements

#### Requirement: Updated FormatFamily type
The FormatFamily type SHALL include the new "CONDITIONS" value.

##### Scenario: Complete family list
- **WHEN** the system lists supported format families
- **THEN** it SHALL include: TABLE-DOUBLE, TABLE-INTEGRATED, SECTIONS, DESCRIPTIVE, PRICE-TABLE, TEXT, CONDITIONS, UNKNOWN

#### Requirement: Format detection patterns updated
The format detection patterns SHALL include CONDITIONS patterns.

##### Scenario: Pattern priority
- **WHEN** multiple patterns match
- **THEN** CONDITIONS SHALL have weight 0.95 (same as DESCRIPTIVE)
- **AND** TABLE-DOUBLE and TABLE-INTEGRATED still have priority 1.0

### Impact
- `formatDetector.ts`: Add CONDITIONS to FormatFamily union type and patterns
- `promptBuilder.ts`: Add CONDITIONS prompt template
- All format consumers: Update switch statements to handle CONDITIONS
