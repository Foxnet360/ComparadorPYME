## ADDED Requirements

### Requirement: Support probabilistic coverage mapping
The system SHALL map coverage names to semantic groups with probability scores rather than single mappings.

#### Scenario: Probabilistic mapping
- **WHEN** "AMPARO BASICO - TODO RIESGO DANO MATERIAL" is processed
- **THEN" the system returns:
  - Group: "Patrimoniales > Edificios", Confidence: 85%
  - Group: "Patrimoniales > Equipos", Confidence: 60%
  - Group: "Riesgos Especiales > Terremoto", Confidence: 45%

### Requirement: Detect composite coverages
The system SHALL identify when a coverage represents multiple underlying coverages.

#### Scenario: Composite detection
- **WHEN** a "TODO RIESGO" or "AMPARO BASICO" coverage is found
- **THEN** the system flags it as composite
- **AND" lists likely component coverages

## MODIFIED Requirements

### Requirement: Map raw coverage names to canonical categories
The system SHALL map extracted coverage names to canonical categories using the thesaurus.

#### Scenario: Thesaurus-based mapping
- **WHEN** a coverage name is extracted from a quote
- **THEN" the system checks the thesaurus for exact matches
- **AND" if found, maps to the canonical category
- **AND" records the match method (exact, synonym, or fuzzy)

### Requirement: Use semantic similarity for coverage matching
The system SHALL use vector embeddings to find semantically similar coverages when thesaurus matching fails.

#### Scenario: Embedding-based matching
- **WHEN** a coverage name has no thesaurus match
- **THEN" the system generates an embedding for the coverage name
- **AND" compares it to embeddings of canonical categories
- **AND" returns the most similar category if above threshold

## REMOVED Requirements

### Requirement: Force single canonical category mapping
**Reason**: Replaced by probabilistic mapping to semantic groups
**Migration**: Use semantic group probabilities instead of single canonical names
