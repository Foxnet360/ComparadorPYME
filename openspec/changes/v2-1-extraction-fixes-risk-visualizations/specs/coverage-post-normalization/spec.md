# Spec: Coverage Post-Normalization

## Capability
Mapeo de coberturas extraídas en formato crudo a las 14 categorías canónicas PYME mediante tesauro, embeddings semánticos y detección de coberturas implícitas, preservando coberturas no canónicas con categorización semántica.

## User Story
**Como** sistema de análisis
**Quiero** normalizar las coberturas extraídas a nombres canónicos
**Para** permitir comparación consistente entre cotizaciones de diferentes aseguradoras

## ADDED Requirements

### Requirement: Map raw coverages to canonical categories
The system SHALL map each raw coverage name to one of the 14 canonical PYME categories using a 4-layer matching system.

#### Scenario: Exact thesaurus match
- **WHEN** a raw coverage name exactly matches a thesaurus entry
- **THEN** the system SHALL return the canonical name with confidence 100%
- **AND** matchMethod SHALL be "thesaurus"

#### Scenario: Fuzzy match with threshold
- **WHEN** a raw coverage has fuzzy similarity >= 80% with a canonical name
- **THEN** the system SHALL return the canonical name with confidence = similarity%
- **AND** matchMethod SHALL be "fuzzy"

#### Scenario: Embedding similarity match
- **WHEN** no thesaurus or fuzzy match is found
- **THEN** the system SHALL generate embeddings for raw name and canonical names
- **AND** if cosine similarity >= 0.85, return canonical name with confidence = similarity%
- **AND** matchMethod SHALL be "embedding"

#### Scenario: LLM fallback match
- **WHEN** no embedding match is found
- **THEN** the system SHALL call Gemini to classify the coverage
- **AND** if confidence >= 70%, return canonical name
- **AND** matchMethod SHALL be "llm"

#### Scenario: No match found
- **WHEN** no match is found across all 4 layers
- **THEN** the system SHALL keep the raw name
- **AND** set canonicalName to null
- **AND** set confidence to 0
- **AND** flag for manual review

### Requirement: Resolve deductibles from general to specific
The system SHALL assign correct deductibles to coverages using specific or general deductible tables.

#### Scenario: Specific deductible exists
- **WHEN** a raw coverage has its own deductible in the extraction
- **THEN** that deductible SHALL be used directly

#### Scenario: General deductible applies
- **WHEN** a coverage has no specific deductible
- **THEN** the system SHALL search generalDeductibles array
- **AND** match by section name or coverage type
- **AND** apply the matching general deductible

#### Scenario: No deductible found
- **WHEN** no specific or general deductible matches
- **THEN** deductible SHALL be "No especificado"
- **AND** a warning flag SHALL be added

### Requirement: Derive insured amounts from asset tables
The system SHALL calculate insured amounts for coverages when not directly specified.

#### Scenario: Coverage with direct amount
- **WHEN** a coverage has insuredAmount in rawCoverages
- **THEN** that amount SHALL be used directly

#### Scenario: Derive from insured assets
- **WHEN** a coverage lacks insuredAmount but insuredAssets exists
- **THEN** the system SHALL:
  - For Incendio: sum EDIFICIOS + CONTENIDOS + MERCANCÍAS
  - For Equipo Eléctrico: use EQUIPO ELÉCTRICO Y ELECTRÓNICO value
  - For Rotura de Maquinaria: use MAQUINARIA Y EQUIPO value
  - For Sustracción: use CONTENIDOS + MERCANCÍAS values
- **AND** mark as derived with confidence 70%

### Requirement: Detect implicit coverages
The system SHALL detect when a coverage is implicitly included in a broader coverage.

#### Scenario: Implicit in broad coverage
- **WHEN** "AMPARO BÁSICO TODO RIESGO" is present
- **THEN** the system SHALL mark Incendio, Terremoto, and HMACC as "implicit"
- **AND** assign the same insuredAmount as the broad coverage
- **AND** set confidence to 50%

#### Scenario: Implicit in sections
- **WHEN** MAPFRE "SECCION PRIMERA" includes multiple coverages in description
- **THEN** each mentioned coverage SHALL be marked as "implicit"
- **AND** all SHALL share the section's insuredAmount

### Requirement: Build final canonical coverage array
The system SHALL produce an array of exactly 14 canonical coverages with statuses.

#### Scenario: Present coverage
- **WHEN** a canonical coverage is found (explicit or implicit)
- **THEN** status SHALL be "present"
- **AND** include insuredAmount, deductible, premium, confidence

#### Scenario: Missing coverage
- **WHEN** a canonical coverage is not found
- **THEN** status SHALL be "missing"
- **AND** all values SHALL be null

#### Scenario: Explicitly excluded
- **WHEN** the PDF explicitly states a coverage is excluded
- **THEN** status SHALL be "excluded"
- **AND** notes SHALL include the exclusion reason

## MODIFIED Requirements

### Requirement: Preserve uncategorized coverages
**Reason**: Previous implementation silently discarded non-canonical coverages, causing empty views for some insurers

#### Scenario: Preserve non-canonical coverages
- **WHEN** raw coverages do not match any of the 14 canonical categories
- **THEN** the system SHALL add them to `uncategorizedCoverages` array
- **AND** assign semantic group using embedding similarity ("asistencias", "amparos-adicionales", "servicios-profesionales", "otros")
- **AND** include metadata: rawName, insuredAmount, deductible, premium, groupId, matchConfidence

#### Scenario: Filter empty uncategorized
- **WHEN** an uncategorized coverage has insuredAmount = 0 AND premium = 0
- **THEN** the system MAY omit it from `uncategorizedCoverages`
- **AND** log the omission for debugging

### Requirement: Assign category metadata to all coverages
**Reason**: Frontend requires categoryId, matchConfidence, and matchMethod for ALL coverages to render correctly

#### Scenario: Canonical coverage metadata
- **WHEN** a coverage maps to a canonical category
- **THEN** the system SHALL set:
  - categoryId: canonical category ID (e.g., "incendio", "lucro-cesante")
  - matchConfidence: confidence score (0-1)
  - matchMethod: "thesaurus" | "fuzzy" | "embedding" | "llm" | "implicit"

#### Scenario: Uncategorized coverage metadata
- **WHEN** a coverage is placed in semantic group
- **THEN** the system SHALL set:
  - categoryId: group ID (e.g., "asistencias", "amparos-adicionales")
  - matchConfidence: embedding similarity score (0-1)
  - matchMethod: "semantic-group"

## Dependencies
- `multimodal-pdf-extraction` for raw coverage data
- `semantic-matching` (existing) for embedding matching
- `thesaurus` (existing) for canonical names
