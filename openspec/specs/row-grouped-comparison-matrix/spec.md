# Spec: Row Grouped Comparison Matrix

## Capability
Motor dinámico de comparación que unifica coberturas, deducibles, e inclusiones en filas agrupadas horizontales, compartiendo la misma lógica lógica de layout para el Dashboard React y la exportación de Excel.

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
