## ADDED Requirements

### Requirement: Create semantic coverage groups dynamically
The system SHALL group insurance coverages into semantic clusters based on vector similarity rather than forcing them into 14 fixed categories.

#### Scenario: Group similar coverages
- **WHEN** coverages from multiple insurers are extracted
- **THEN** the system creates dynamic semantic groups (e.g., "Daño Material Group")
- **AND** each coverage can belong to multiple groups with confidence scores
- **AND" groups are named based on common semantic themes

### Requirement: Support probabilistic coverage mapping
The system SHALL map raw coverage names to semantic groups with probability distributions rather than single forced mappings.

#### Scenario: Probabilistic mapping of composite coverage
- **WHEN" "AMPARO BASICO - TODO RIESGO DANO MATERIAL" is processed
- **THEN" the system returns multiple potential groups:
  - "Patrimoniales > Edificios" with 85% confidence
  - "Patrimoniales > Equipos" with 60% confidence
  - "Riesgos Especiales > Terremoto" with 45% confidence
- **AND" the system marks it as composite (includes multiple coverages)

### Requirement: Detect composite coverages
The system SHALL identify when a single coverage item represents multiple underlying coverages.

#### Scenario: Detect "Todo Riesgo" composite
- **WHEN** a coverage labeled "TODO RIESGO" or "AMPARO BASICO" is found
- **THEN** the system flags it as composite
- **AND" lists likely components: Incendio, Terremoto, HMACC, Sustracción
- **AND" suggests reviewing the detailed description for confirmation

### Requirement: Maintain ontology hierarchy
The system SHALL support a three-level ontology hierarchy: Families > Sub-families > Variants.

#### Scenario: Navigate ontology levels
- **WHEN** querying a coverage
- **THEN** the system shows:
  - Level 1 (Family): "Patrimoniales"
  - Level 2 (Sub-family): "Edificios y Contenidos"
  - Level 3 (Variants): "AMPARO BASICO" (MAPFRE), "TODO RIESGO" (BBVA), etc.
