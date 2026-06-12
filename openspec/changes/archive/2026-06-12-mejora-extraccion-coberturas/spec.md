# Delta Spec: Improve Coverage, Deductible, and Condition Extraction

## Purpose

This change makes quote extraction insurer-aware and layout-aware by adding a Template Registry, reconstructing tables with `pdfjs` coordinates, and backing normalization with a probabilistic semantic graph that learns from analyst corrections.

## Capabilities

### New Capabilities
- `insurer-template-registry`: Detect insurer-specific PDF templates and enforce structured extraction schemas.
- `layout-aware-quote-extraction`: Reconstruct tables from `pdfjs` bounding boxes before LLM cell filling.
- `coverage-semantic-graph`: Probabilistic graph for coverage mapping, deductible linking, composite decomposition, and learning.

### Modified Capabilities
- `format-family-detection`: Add insurer-template fingerprint detection.
- `semantic-coverage-matching`: Consume graph probabilities and composite decompositions.
- `coverage-post-normalization`: Accept decomposed coverages and graph-derived probabilities.
- `deductible-semantic-parser`: Use template-specific deductible locations and graph rules.
- `learning-engine`: Persist corrections as graph edges/aliases.

---

## ADDED Requirements

### Requirement: Detect insurer-specific templates

The system SHALL identify known insurer templates from PDF layout and text markers before extraction.

#### Scenario: BBVA template detected

- **GIVEN** a PDF contains "BBVA SEGUROS" and a table headed "COBERTURAS / DEDUCIBLE"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"bbva-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the BBVA schema

#### Scenario: SBS template detected

- **GIVEN** a PDF contains "SEGUROS SBS" and "Resumen de coberturas y primas"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"sbs-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the SBS schema

#### Scenario: MAPFRE template detected

- **GIVEN** a PDF contains "MAPFRE" and section markers "SECCION PRIMERA/SEGUNDA"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"mapfre-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the MAPFRE schema

#### Scenario: Unknown insurer falls back to graph

- **GIVEN** a PDF matches no registered template
- **WHEN** extraction runs
- **THEN** the system SHALL use the legacy vision path
- **AND** send extracted coverages through the semantic graph

### Requirement: Enforce template schemas

The system SHALL constrain extracted fields to a JSON schema defined per template.

#### Scenario: Schema-valid extraction

- **GIVEN** a known template is detected
- **WHEN** the LLM returns extracted cells
- **THEN** the system SHALL validate the payload against the template schema
- **AND** reject fields that violate type, range, or required constraints

### Requirement: Reconstruct tables from PDF layout

The system SHALL rebuild row/column structure from `pdfjs` bounding boxes before LLM extraction.

#### Scenario: Table reconstruction succeeds

- **GIVEN** a PDF page contains a coverage table with aligned columns
- **WHEN** layout parsing runs
- **THEN** the system SHALL return rows with cell coordinates, text, and inferred column headers
- **AND** preserve row order and merged-cell annotations

#### Scenario: Layout parse failure falls back to vision

- **GIVEN** `pdfjs` cannot reconstruct a table (e.g., rotated or scanned page)
- **WHEN** layout parsing fails
- **THEN** the system SHALL log the failure
- **AND** fall back to the vision-based extraction path

### Requirement: Build and query a coverage semantic graph

The system SHALL maintain a probabilistic graph linking raw terms, insurer aliases, canonical categories, deductibles, and decomposition rules.

#### Scenario: Graph-based coverage mapping

- **GIVEN** the raw term "Daño Material Todo Riesgo"
- **WHEN** the graph is queried
- **THEN** the system SHALL return ranked mappings:
  - `incendio-edificio-contenidos`: 0.92
  - `equipo-electronico`: 0.45
- **AND** include edge provenance (`alias`, `thesaurus`, `learned`)

#### Scenario: Composite coverage decomposition

- **GIVEN** the raw coverage "Amparo Básico Todo Riesgo"
- **WHEN** the graph contains a decomposition rule
- **THEN** the system SHALL emit implicit coverages `incendio`, `terremoto`, `huelga-motin-asonada`
- **AND** mark each with confidence and `isImplicit: true`

#### Scenario: Deductible linking via graph

- **GIVEN** a deductible text and a canonical coverage
- **WHEN** the graph is queried for deductible applicability
- **THEN** the system SHALL return `appliesTo` coverage IDs and a confidence score
- **AND** prefer template-specific rules when available

### Requirement: Learn corrections into the graph

The system SHALL write analyst corrections into the semantic graph as weighted edges or aliases.

#### Scenario: Correction creates learned edge

- **GIVEN** an analyst maps raw name "Daño Material Global" to `incendio-edificio-contenidos`
- **WHEN** the correction is saved
- **THEN** the system SHALL add a learned edge with weight based on correction frequency
- **AND** increment the graph edge confidence for future queries

---

## MODIFIED Requirements

### Requirement: Detect format family from PDF text

The system SHALL analyze extracted text and classify it into one of six format families, and SHALL additionally detect insurer-specific templates.

(Previously: format detection selected only among six generic families.)

#### Scenario: TABLE-DOUBLE detection (HDI style)

- **WHEN** extracted text contains "DEDUCIBLES QUE APLICAN" AND "AMPAROS BASICOS"
- **THEN** the system SHALL classify as "TABLE-DOUBLE"
- **AND** set confidence to 95%

#### Scenario: Insurer template takes precedence over generic family

- **WHEN** a PDF matches both a generic family and a registered insurer template
- **THEN** the system SHALL return the insurer templateId
- **AND** set `formatFamily` to the corresponding generic family for compatibility

### Requirement: Provide format metadata

The system SHALL return format family information alongside detection results, including template metadata when applicable.

(Previously: metadata did not include insurer template fields.)

#### Scenario: Return format metadata

- **WHEN** format detection completes
- **THEN** the system SHALL return:
  - `family`: string (one of the 6 families)
  - `confidence`: number (0-100)
  - `detectedPatterns`: string[]
  - `templateId`: string | null
  - `templateConfidence`: number | null
  - `pageCount`: number
  - `hasTables`: boolean
  - `hasSections`: boolean

### Requirement: Support probabilistic coverage mapping

The system SHALL map coverage names to canonical categories using graph probabilities and composite decomposition rules, in addition to the existing thesaurus/fuzzy/embedding/LLM layers.

(Previously: mapping returned a flat list of semantic groups without insurer-aware graph probabilities or composite decomposition.)

#### Scenario: Probabilistic mapping with graph

- **WHEN** "AMPARO BASICO - TODO RIESGO DANO MATERIAL" is processed
- **THEN** the system returns graph-ranked mappings:
  - `incendio-edificio-contenidos`: 0.85
  - `equipo-electronico`: 0.60
  - `terremoto-catastrofico`: 0.45
- **AND** flags the coverage as composite when a decomposition rule matches

#### Scenario: Composite detection uses graph rules

- **WHEN** a coverage matches a graph decomposition rule
- **THEN** the system flags it as composite
- **AND** lists component coverages derived from the rule

### Requirement: Map raw coverages to canonical categories

The system SHALL map each raw coverage name to one of the 14 canonical PYME categories using a 4-layer matching system, and SHALL augment results with graph-derived probabilities and decomposed implicit coverages.

(Previously: mapping produced a single canonical result per coverage without graph probabilities or decomposition.)

#### Scenario: Exact thesaurus match

- **WHEN** a raw coverage name exactly matches a thesaurus entry
- **THEN** the system SHALL return the canonical name with confidence 100%
- **AND** matchMethod SHALL be "thesaurus"

#### Scenario: Graph probability augmentation

- **WHEN** a coverage maps to a canonical category
- **THEN** the system SHALL include `graphConfidence` when available
- **AND** use the maximum of graph confidence and layer confidence for ranking

#### Scenario: Decomposed coverage injection

- **WHEN** a composite coverage is decomposed into implicit coverages
- **THEN** the system SHALL inject each implicit coverage into the canonical array
- **AND** preserve the original raw coverage as a parent reference

### Requirement: Build final canonical coverage array

The system SHALL produce an array of canonical coverages with statuses, including decomposed implicit coverages and graph confidence metadata.

(Previously: the array did not include graph-derived decompositions or probabilities.)

#### Scenario: Present coverage with graph metadata

- **WHEN** a canonical coverage is found (explicit or implicit)
- **THEN** status SHALL be "present"
- **AND** it SHALL include `insuredAmount`, `deductible`, `premium`, `confidence`, `graphConfidence`, `matchMethod`

#### Scenario: Missing coverage

- **WHEN** a canonical coverage is not found
- **THEN** status SHALL be "missing"
- **AND** all values SHALL be null

### Requirement: Parse compound deductible structures

The system SHALL parse complex deductible expressions using deterministic regex, template-specific location hints, and graph deductible-applicability rules.

(Previously: parsing used regex and LLM fallback without insurer-template locations or graph rules.)

#### Scenario: Template-specific deductible location

- **GIVEN** a known template places deductible text in column 3
- **WHEN** the system parses deductible cells
- **THEN** it SHALL prefer column 3 text for that template
- **AND** fall back to regex on the full row if column text is empty

#### Scenario: Graph rule determines applicability

- **GIVEN** a deductible text is parsed
- **WHEN** the graph contains an `appliesTo` rule for the current insurer
- **THEN** the system SHALL assign the deductible to the linked coverages
- **AND** include `applicabilityConfidence` in the result

### Requirement: Deterministic Parsing First

The system MUST attempt regex + benchmark table parsing before falling back to LLM for deductible extraction, and SHALL consult graph applicability rules before assigning deductibles to coverages.

(Previously: deterministic parsing did not consult graph applicability rules.)

#### Scenario: Regex and graph rule hit

- **WHEN** the text "10% min 5 SMMLV" is parsed
- **THEN** the regex pattern matches and benchmark tables evaluate the normalized value
- **AND** the graph links the deductible to the applicable coverage
- **AND** no LLM call is made

#### Scenario: LLM Fallback

- **WHEN** the text does not match any known regex pattern
- **THEN** the system falls back to Gemini for parsing
- **AND** the result is cached in Redis with a versioned key

### Requirement: Capture user corrections

The system SHALL provide an interface for users to correct system mappings and extractions, and SHALL persist corrections as graph edges/aliases in addition to the existing thesaurus/cache updates.

(Previously: corrections updated the thesaurus and cache only.)

#### Scenario: User corrects coverage mapping

- **WHEN** a user corrects a coverage mapping or deductible in the comparison grid
- **THEN** the system SHALL store this correction in the database
- **AND** add or update a learned edge in the semantic graph
- **AND** invalidate affected cache entries immediately

### Requirement: Update thesaurus from corrections

The system SHALL automatically update the thesaurus and the semantic graph when users make corrections.

(Previously: corrections updated the thesaurus only.)

#### Scenario: Thesaurus and graph update

- **WHEN** a user corrects a mapping
- **THEN** the system adds the raw name as a synonym for the corrected category
- **AND** adds/updates a graph edge from raw term to canonical category
- **AND** increments a correction count for that mapping

---

## Data Contracts

### Template Registry Entry

```json
{
  "templateId": "bbva-pyme-v1",
  "insurer": "BBVA",
  "displayName": "BBVA PYME",
  "fingerprints": {
    "textMarkers": ["BBVA SEGUROS", "COBERTURAS / DEDUCIBLE"],
    "layoutMarkers": [{ "page": 1, "region": "top-right", "textRegex": "BBVA" }]
  },
  "schema": {
    "type": "object",
    "required": ["coverages"],
    "properties": {
      "coverages": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["rawName", "insuredAmount", "deductible"],
          "properties": {
            "rawName": { "type": "string" },
            "insuredAmount": { "type": "string" },
            "deductible": { "type": "string" },
            "premium": { "type": "string" },
            "subLimits": { "type": "array" }
          }
        }
      }
    }
  }
}
```

### Layout Reconstruction Output

```json
{
  "page": 1,
  "tables": [{
    "rows": [[{"text": "Incendio", "x": 120, "y": 300, "width": 80, "height": 12}]],
    "headers": ["Cobertura", "Suma Asegurada", "Deducible", "Prima"]
  }]
}
```

### Coverage Semantic Graph (simplified)

```json
{
  "nodes": [
    { "id": "raw:daño-material-global", "type": "raw_term" },
    { "id": "cat:incendio-edificio-contenidos", "type": "canonical_category" },
    { "id": "alias:bbva-dmg", "type": "insurer_alias", "insurer": "BBVA" }
  ],
  "edges": [
    { "from": "raw:daño-material-global", "to": "cat:incendio-edificio-contenidos", "type": "learned", "weight": 0.85, "correctionCount": 12 },
    { "from": "alias:bbva-dmg", "to": "raw:daño-material-global", "type": "alias", "weight": 1.0 }
  ]
}
```

### Normalized Coverage Output

```json
{
  "canonicalId": "incendio-edificio-contenidos",
  "status": "present",
  "insuredAmount": "$500,000,000",
  "deductible": { "percentage": 10, "minAmount": 6500000, "maxAmount": 65000000 },
  "premium": "$1,200,000",
  "confidence": 0.92,
  "graphConfidence": 0.85,
  "matchMethod": "thesaurus",
  "isImplicit": false,
  "parentRawName": null
}
```

---

## Error Handling

| Failure | Expected Behavior |
|---------|-------------------|
| Template fingerprint match below threshold | Treat as unknown template; fall back to generic family + vision extraction. |
| `pdfjs` layout parse failure | Log `layout_parse_failed` metric; fall back to legacy vision path. |
| Template schema validation failure | Return structured error with violated fields; fall back to vision path. |
| Graph query returns no results | Use existing thesaurus/embedding/LLM pipeline; mark `graphConfidence: null`. |
| Graph decomposition ambiguity | Emit all candidates with confidence; flag for analyst review when top-two confidence gap < 0.15. |
| Correction persistence failure | Retry once; on repeated failure, queue correction and alert operators. |

---

## Boundaries

The following remain explicitly out of scope:

- Replacing the PDF text extraction engine or adding OCR/scanned-PDF support.
- Changing the 14 canonical PYME categories.
- Rewriting clause RAG or premium calculation logic.
- Activating `useUnifiedComparisonEngine`.
- Frontend redesign beyond new confidence/review flags.
- Initial templates are limited to BBVA, SBS, and MAPFRE; additional insurers may be added in follow-up changes.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage extraction accuracy (top 5 insurers) | >= 85% | Golden set evaluation harness |
| Deductible assignment accuracy | >= 80% | Golden set evaluation harness |
| Manual analyst completion rate per quote | Drop >= 30% | Analyst correction logs |
| Average corrections per quote | Drop >= 25% | Correction telemetry |
| Uncategorized/no-match rate | < 10% | Post-normalization reports |
| End-to-end latency increase | <= 20% | Production trace metrics |
| Template detection precision | >= 90% | Golden set, per-template |
| Graph cold-start coverage | >= 80% of thesaurus seeded | Graph audit query |

---

## Dependencies

- `pdfjs-dist` for layout extraction.
- Annotated golden set (30+ quotes across top insurers).
- Supabase/Redis storage for graph edges and template registry.
- Analyst validation time for template schemas.
