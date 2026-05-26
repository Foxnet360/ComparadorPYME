## ADDED Requirements

### Requirement: Compare coverage variables directly
The system SHALL compare insurance quotes by variables (insured amount, deductible, sublimit, exclusions) without forcing canonical categories.

#### Scenario: Compare similar coverages across insurers
- **WHEN** comparing quotes from MAPFRE and CHUBB
- **THEN" the system matches "AMPARO BASICO" (MAPFRE) with "AMPARO BÁSICO" (CHUBB)
- **AND" compares their variables side-by-side:
  - Insured Amount: $500M vs $450M
  - Deductible: 10% vs 10% + min 5 SMMLV
  - Exclusions: [guerra, terrorismo] vs [guerra, terrorismo, inundación]

### Requirement: Generate variable comparison matrices
The system SHALL generate dynamic comparison matrices based on detected variables rather than fixed 14-row tables.

#### Scenario: Generate comparison matrix
- **WHEN** 4 quotes are compared
- **THEN** the matrix includes:
  - Rows for each semantic group found
  - Columns for each insurer
  - Cells showing the specific variable values
  - Highlighting of best/worst values per variable

### Requirement: Identify coverage gaps
The system SHALL identify when one insurer offers coverage in a semantic group that others do not.

#### Scenario: Identify exclusive coverage
- **WHEN" comparing quotes and CHUBB includes "Equipo Móvil Fuera de Predios"
- **THEN** the system flags this as exclusive to CHUBB
- **AND** notes it as a competitive advantage

### Requirement: Support user-defined comparison weights
The system SHALL allow users to prioritize which variables matter most for comparison.

#### Scenario: User prioritizes low deductibles
- **WHEN** a user sets deductible weight to 80% and price to 20%
- **THEN** the comparison ranking prioritizes insurers with better deductibles
- **AND** the matrix reflects these weights in scoring
