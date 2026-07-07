# Delta Specs: Granular Comparison Schema

This change replaces the rigid four-row comparison schema with a granular, section-aware template. It affects four capabilities: `unified-comparison-extraction`, `extraction-quality-evaluation`, `unified-coverage-matrix`, and `row-grouped-comparison-matrix`.

---

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

---

# Delta for Extraction Quality Evaluation

## MODIFIED Requirements

### Requirement: Fixed quote set baseline

The system SHALL store a fixed set of 3 quote PDFs and a direct-chat prompt that requests a granular, section-aware comparison table with canonical sub-rows.

(Previously: the baseline prompt requested the four-row comparison table.)

#### Scenario: Baseline generation

- GIVEN the fixed 3-quote set
- WHEN the harness calls Gemini with the direct-chat granular prompt and all PDFs
- THEN it SHALL capture the baseline table cells
- AND it SHALL persist the baseline for reproducible comparisons
- AND the baseline rows MAY vary in count and section

### Requirement: Tool path comparison

The system SHALL run the same 3-quote set through `/api/analyze` using the unified engine under the `granularComparisonSchema` flag.

#### Scenario: Tool extraction

- GIVEN the fixed 3-quote set
- WHEN the harness POSTs the PDFs to `/api/analyze` with the flag enabled
- THEN it SHALL receive the tool output table
- AND it SHALL map tool cells to baseline cells by canonical row label and insurer column

### Requirement: Cell-level metric

The system SHALL compute the percentage of matching cells between baseline and tool output, aligning rows by canonical label and allowing variable row counts.

(Previously: required the same insurers and rows and compared fixed coordinates.)

#### Scenario: Match calculation

- GIVEN baseline and tool tables with the same insurers and canonical row labels
- WHEN the metric runs
- THEN it SHALL count cells with equivalent semantic content as matches
- AND it SHALL report mismatches with row label, column, baseline, and tool values
- AND the match rate SHALL be >= 90% for the first slice

### Requirement: Regression guard

The system SHALL run the evaluation harness as part of the Vitest suite and assert the match rate for the granular baseline.

#### Scenario: CI execution

- GIVEN the harness is invoked by `npm test`
- WHEN the comparison completes
- THEN it SHALL assert match rate >= 90%
- AND it SHALL fail the test if the unified engine fallback rate exceeds 10%

---

# Delta for Unified Coverage Matrix

## MODIFIED Requirements

### Requirement: Matriz de comparación unificada

El frontend SHALL renderizar la comparación en una matriz de filas granulares agrupadas por secciones. Cada sección MAY contener sub-filas como Edificio, Contenidos, Mercancías, deducibles por cobertura, Prima con IVA, y Forma de Pago.

(Previously: renderizaba exactamente 14 filas fijas de categorías canónicas.)

#### Scenario: Visualización de secciones

- WHEN el usuario ve el tab "Coberturas" del reporte de comparación
- THEN la tabla muestra encabezados de sección (e.g., `INFORMACIÓN GENERAL`, `BIENES ASEGURADOS`)
- AND cada sección muestra sus filas granulares debajo del encabezado
- AND se preserva el orden canónico de sub-filas dentro de cada sección

#### Scenario: Cobertura presente

- WHEN una celda contiene un valor extraído
- THEN la celda muestra el valor asegurado o deducible
- AND muestra el badge de confianza derivado de la señal de extracción

#### Scenario: Cobertura ausente

- WHEN una cotización NO incluye un valor para una sub-fila canónica
- THEN la celda muestra "No incluida" en gris claro

#### Scenario: Disparador de visor PDF

- WHEN una celda tiene evidencia RAG con pageNumber
- THEN se muestra un botón "Ver Evidencia" o el número de página como link clicable
- AND al hacer clic se abre el visor PDF integrado en la página correspondiente

#### Scenario: Doble-clic para notas

- WHEN el usuario hace doble clic en una celda de cobertura
- THEN se abre el editor inline de notas consultivas
- AND la celda muestra un icono de nota si tiene contenido guardado

### Requirement: Indicadores de confianza visual

Cada celda de cobertura SHALL mostrar el nivel de confianza del match o de la extracción mediante badges de color. El valor de confianza MUST provenir del campo `confidence` de la celda, no de un valor hardcodeado.

(Previously: los badges se basaban en `matchConfidence` fijado o heredado del motor de matching.)

#### Scenario: Confianza alta

- WHEN cell.confidence >= 0.9
- THEN se muestra badge verde con tooltip "Match exacto"

#### Scenario: Confianza media

- WHEN cell.confidence entre 0.7 y 0.89
- THEN se muestra badge amarillo con tooltip "Match aproximado"

#### Scenario: Confianza baja

- WHEN cell.confidence < 0.7
- THEN se muestra badge rojo con tooltip "Revisar match"

#### Scenario: Tooltip con nombre original

- WHEN el usuario hace hover sobre una celda de cobertura
- THEN el tooltip muestra el nombre original extraído del PDF, el nombre canónico, el método de match usado, Y la fuente del valor (extraído/calculado/inferido)

## ADDED Requirements

### Requirement: Encabezado de sección como fila propia

La matriz SHALL renderizar cada sección como una fila de encabezado que abarca todas las columnas, separando visualmente los grupos de sub-filas.

#### Scenario: Render de encabezado

- WHEN la matriz recibe filas con `section` definida
- THEN se inserta una fila de encabezado con el nombre de la sección
- AND las filas de datos siguen directamente debajo de su encabezado

---

# Delta for Row Grouped Comparison Matrix

## MODIFIED Requirements

### Requirement: Matrix transformation to flat row schema

The system SHALL transform `FlatComparisonResult` (schema v2) into a flat array of `MatrixRow[]` items that preserve section grouping. Each canonical row SHALL become a data row under its assigned section header.

(Previously: transformed raw `QuoteData[]` into rows grouped by fixed coverage categories.)

#### Scenario: Successful transformation of granular rows

- WHEN the system transforms a schema v2 comparison
- THEN it SHALL generate a `MatrixRow` of type 'header' for each section
- AND it SHALL generate a `MatrixRow` of type 'data' for each canonical sub-row under that section
- AND the columns of cell values in each data row SHALL correspond exactly to each insurer's quote in order
- AND each data cell SHALL carry its derived `confidence`

### Requirement: Exclusive coverages mapping in matrix

The system SHALL identify exclusive coverages and place them in a dedicated section. The system MUST NOT treat canonical granular rows as exclusive coverages solely because they appear in a single insurer column.

(Previously: exclusive coverages were grouped by low match confidence or no category mapping.)

#### Scenario: Mapping exclusive coverages

- WHEN an analysis has coverages with `matchConfidence` < 0.65 or no category mapping and they are NOT canonical rows
- THEN the system SHALL group them as exclusive coverages
- AND create a dedicated row in the matrix where Column A displays the exclusive coverage name
- AND the insurer column that offers it displays its value and deductible details
- AND all other insurer columns display 'No incluida' / 'N.C.'

#### Scenario: Single-insurer canonical row

- WHEN a canonical sub-row (e.g., "Mercaderías") has a value for only one insurer
- THEN the system SHALL keep it under its section header
- AND it SHALL NOT move it to the exclusive coverages section

### Requirement: Unified React layout rendering

The frontend React dashboard SHALL render the unified `MatrixRow[]` schema in a horizontal responsive table that supports section headers and granular data rows with the same monochromatic slate and blue styling.

(Previously: rendered grouped rows by fixed coverage categories without section headers.)

#### Scenario: Render grouped rows in frontend

- WHEN the React matrix component receives a list of `MatrixRow` items containing section headers
- THEN header rows SHALL be rendered spanning all columns with a soft blue background (#E6F0FA) and bold blue text (#0066CC)
- AND section header rows SHALL be visually distinct from category header rows
- AND data rows SHALL render the row label in Column A with a soft gray background (#F8FAFC)
- AND cells for insurers SHALL display formatted currencies, deductible badges, or italic red 'No incluida' text
- AND the layout SHALL alternate row background colors cleanly

## ADDED Requirements

### Requirement: Section-aware export preservation

The system SHALL preserve section grouping when exporting the matrix to Excel/CSV, ensuring each section header precedes its data rows in the output.

#### Scenario: Export with sections

- WHEN the user exports the comparison matrix
- THEN section headers appear as merged or labeled rows
- AND granular data rows follow their section header in the same sheet
