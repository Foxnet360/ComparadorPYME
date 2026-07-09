# Spec: Unified Comparison Extraction

## Capability
Motor multimodal que procesa múltiples cotizaciones de seguros simultáneamente en una sola llamada LLM, generando un JSON comparativo estructurado que replica la matriz de comparación del Excel técnico.

## Requirements

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
- **WHEN** a deductible text reads "10% del valor de la pérdida, mínimo 1 SMMLV"
- **THEN** the system SHALL extract it as a structured object: `{percentage: 10, minimum: 1, currency: "SMMLV", type: "percentage_with_minimum"}`
- **AND** it SHALL flag it as ambiguous (`isAmbiguous: true`) if the text is unclear or incomplete
- **AND** it SHALL use "Ver condiciones" as fallback when the deductible cannot be determined from the quote

#### Scenario: Exclusive coverage detection
- **WHEN** an insurer offers a coverage not present in other quotes
- **THEN** the system SHALL mark it as exclusive in the comparison matrix
- **AND** it SHALL note it in the analysis section as competitive advantage/disadvantage

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

### Requirement: Flat table parser

The system SHALL parse LLM comparison output as a flat table regardless of whether it is returned as Markdown, CSV, JSON array, or key-value list.

#### Scenario: Markdown table

- GIVEN the LLM returns a Markdown table
- WHEN the parser runs
- THEN it SHALL extract rows, columns, and cells
- AND it SHALL normalize whitespace and delimiters

#### Scenario: CSV-like output

- GIVEN the LLM returns comma-separated values
- WHEN the parser runs
- THEN it SHALL detect separators and quote boundaries
- AND it SHALL map values to insurers and concepts

#### Scenario: Missing or extra rows

- GIVEN the table omits a requested row or adds an unexpected row
- WHEN the parser runs
- THEN it SHALL flag the missing row as `not_found`
- AND it SHALL keep unexpected rows in an `extraRows` array

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

### Requirement: Result caching
The system SHALL cache comparison results for performance.

#### Scenario: Identical files
- **WHEN** the same set of PDFs is uploaded again
- **THEN** the system SHALL return the cached result
- **AND** processing time SHALL be < 1 second

## Dependencies
- `multimodal-pdf-extraction` for PDF upload
- `gemini-model-configuration` for LLM settings
- `coverage-post-normalization` for canonical mapping

---

## Delta from change: corregir-reporte-comparativo

## ADDED Requirements

### Requirement: Authenticated user-scoped comparison sync
- `/api/comparison/unified` routes MUST utilize standard `authMiddleware` for extraction/retrieval.
- Active comparisons and companies MUST be stored in Supabase under the authenticated `user_id` when present.
- Guest sessions MUST gracefully fallback to unpersisted anonymous runs.

#### Scenario: Authenticated user comparison syncs to database
- **GIVEN** a request contains a valid Supabase JWT in the `Authorization` header
- **WHEN** the user triggers comparison extraction
- **THEN** the server SHALL associate the record with the user's ID
- **AND** save the extracted client company under the user's Supabase account

#### Scenario: Anonymous guest comparison bypasses persistence
- **GIVEN** a request with no token
- **WHEN** comparison extraction runs
- **THEN** the system SHALL return the result directly
- **AND** SHALL NOT write any record to Supabase

### Requirement: Colombian decimal-aware premium parsing
- Extractors MUST accurately parse Colombian currency values (e.g., `$1.134.400,00`, `$1.134.400`, `1134400.00`).
- The premium parser MUST NOT overflow, multiply by 100, or return integer-truncated prices.
- If unparseable, the parser SHALL fallback to the original string, not a zero or garbage number.

#### Scenario: Parsing standard Colombian premium format
- **GIVEN** a premium string of `$1.134.400,00` or `$1.134.400`
- **WHEN** the premium decimal parser processes the value
- **THEN** the output numeric value is exactly `1134400.00`

### Requirement: Semantic coverage ontology mapping
- Unified engine row outputs MUST be normalized through `coverageNormalizer` and `thesaurusMapper`.
- Mapped rows SHALL receive an ontology-compliant `categoryId` and `canonicalName`.
- Unmapped rows MUST NOT be dropped; they SHALL be grouped as exclusive coverages under "unmapped".
- Top comparison matrix MUST render only canonical/mapped rows.
- Bottom comparison section MUST exclude non-coverage info (billing/payment terms).

#### Scenario: Normalized canonical row matching
- **GIVEN** raw extraction containing "Bienes bajo tierra"
- **WHEN** passed through semantic thesaurus mapping
- **THEN** the row SHALL be assigned categoryId "BIENES" and canonicalName "Bienes Bajo Tierra"

### Requirement: Dynamic quote scoring & risk auditing
- Quote scores MUST be computed per-insurer by `quoteScorer`.
- Real `extractionConfidence` values MUST be calculated from extraction heuristics rather than returning a static 85.
- Real risk parameters, advantages, and conditions MUST be processed via `quoteBasedAuditor`.

#### Scenario: Dynamically computed quote analysis scores
- **GIVEN** a valid extracted quote structure
- **WHEN** requested to compute comparisons
- **THEN** overall scores and radar dimensions reflect actual mathematical rules

### Requirement: Visual view toggling and deductible formatting
- Client/Técnico toggle MUST control client-side rendering views.
- Técnico mode MUST display confidence badges, technical citations, and detailed Technical Analysis.
- Semicolon-delimited deductibles (e.g., `Seda: 10% min 1SMMLV; Otras: 15%`) MUST be parsed and rendered as structured line items.

#### Scenario: Técnico view renders full evidence details
- **GIVEN** Técnico mode is active
- **WHEN** the comparison matrix renders
- **THEN** confidence badges and citation links MUST be visible

#### Scenario: Semicolon-delimited deductibles are formatted
- **GIVEN** a deductible string containing a semicolon
- **WHEN** rendered in the cell
- **THEN** the string SHALL be parsed into multiple separate clean list items
