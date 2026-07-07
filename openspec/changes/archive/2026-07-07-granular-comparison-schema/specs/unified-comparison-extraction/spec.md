# Delta for Unified Comparison Extraction

## MODIFIED Requirements

### Requirement: Single-call multimodal comparison

The system SHALL process N quote PDFs in a single Gemini API call and request a section-aware, granular comparison template. The template MUST suggest sub-rows such as Edificio, Contenidos, Mercancías, and per-coverage deductibles while allowing the LLM to include, omit, or rename rows.

(Previously: requested a flat table with exactly four fixed rows: Bienes Asegurados, Deducibles, Prima con IVA, and Forma de Pago.)

#### Scenario: Successful comparison of 4 quotes

- GIVEN 4 quote PDFs (MAPFRE, CHUBB, BBVA, AXA)
- WHEN the system uploads all PDFs and calls Gemini with the granular section-aware prompt
- THEN it SHALL receive a table-formatted response within 60 seconds
- AND the table SHALL contain one or more rows per section and one column per insurer
- AND each cell SHALL contain the raw value as shown in the quote

#### Scenario: Coverage equivalence detection

- GIVEN two insurers use different names for the same concept (e.g., "Eq. Eléctrico" vs "Equipo Eléctrico")
- WHEN the flat table is parsed and alias normalization runs
- THEN the system SHALL preserve each insurer's raw wording in its cell
- AND it SHALL map equivalent labels to the same canonical row
- AND it SHALL NOT force values into the 14-category ontology

#### Scenario: Deductible structured extraction

- WHEN a deductible text reads "10% del valor de la pérdida, mínimo 1 SMMLV"
- THEN the system SHALL extract it as a structured object: `{percentage: 10, minimum: 1, currency: "SMMLV", type: "percentage_with_minimum"}`
- AND it SHALL flag it as ambiguous (`isAmbiguous: true`) if the text is unclear or incomplete
- AND it SHALL use "Ver condiciones" as fallback when the deductible cannot be determined from the quote

#### Scenario: Exclusive coverage detection

- WHEN an insurer offers a coverage not present in other quotes
- THEN the system SHALL mark it as exclusive in the comparison matrix
- AND it SHALL note it in the analysis section as competitive advantage/disadvantage

### Requirement: JSON schema validation

The system SHALL validate the LLM output against a schema-aware, table-friendly schema that includes `schemaVersion`, optional `section` per row, and optional per-cell `confidence`. It SHALL fallback to legacy processing after a bounded retry.

(Previously: validated a flat four-row schema without version or section metadata.)

#### Scenario: Valid granular output

- GIVEN the LLM returns a parseable granular table
- WHEN the system validates it against the schema v2
- THEN it SHALL accept it and process normally
- AND each row SHALL carry its assigned section
- AND each cell SHALL carry a derived confidence value

#### Scenario: Invalid output

- GIVEN the LLM returns malformed or non-tabular output
- WHEN the parser cannot produce a valid table
- THEN it SHALL retry with a correction prompt up to 2 times
- AND if still invalid it SHALL return a structured failure to the adapter for legacy fallback

## ADDED Requirements

### Requirement: Alias normalization

The system SHALL maintain a canonical alias dictionary that maps common wording variants to canonical sub-row labels. The parser MUST prefer the most specific alias and route ambiguous labels to `extraRows`.

#### Scenario: Canonical alias match

- GIVEN a row label "Valor Edificio" in the LLM output
- WHEN the parser normalizes labels
- THEN it SHALL map the row to the canonical label "Edificio"

#### Scenario: Ambiguous alias

- GIVEN a row label "Equipo" that could match EEE or Maquinaria
- WHEN the parser normalizes labels
- THEN it SHALL route the row to `extraRows`
- AND it SHALL flag it for manual review

### Requirement: Section assignment

The system SHALL assign every canonical row to a section. Known sections include `INFORMACIÓN GENERAL`, `BIENES ASEGURADOS`, `COBERTURAS`, `DEDUCIBLES`, and `CONDICIONES`.

#### Scenario: Section inferred from label

- GIVEN a row labelled "Prima con IVA"
- WHEN the parser assigns sections
- THEN it SHALL place the row under `INFORMACIÓN GENERAL`

### Requirement: Derived per-cell confidence

The system SHALL compute each cell's confidence from extraction signals: `notFound` flag, raw-text presence, alias match quality, and value-pattern validation. The system MUST NOT hardcode confidence to a single value such as `0.85`.

#### Scenario: Confidence from signals

- GIVEN a cell with a matched alias, present raw text, and valid currency pattern
- WHEN confidence is computed
- THEN it SHALL be >= 0.7
- AND it SHALL differ from cells with missing or ambiguous signals

### Requirement: Feature flag gating

The system SHALL gate schema v2 processing behind the feature flag `granularComparisonSchema`. When the flag is disabled, the system MUST use the legacy v1 prompt, parser, and schema.

#### Scenario: Flag disabled

- GIVEN `granularComparisonSchema` is `false`
- WHEN a comparison is requested
- THEN the system SHALL use the four-row v1 prompt and schema

### Requirement: Backward compatibility with cached v1 results

The system SHALL read the `schemaVersion` field on cached comparison objects. If `schemaVersion` is missing or `1`, the system MUST route the object through the v1 rendering path or regenerate it with v2.

#### Scenario: Cached v1 object

- GIVEN a cached comparison result without `schemaVersion`
- WHEN the report is rendered
- THEN the system SHALL treat it as schema v1
- AND it SHALL render it through the legacy matrix path
