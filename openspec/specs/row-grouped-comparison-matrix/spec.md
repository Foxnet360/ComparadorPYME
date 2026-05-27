# Spec: Row Grouped Comparison Matrix

## Capability
Motor dinámico de comparación que unifica coberturas, deducibles, e inclusiones en filas agrupadas horizontales, compartiendo la misma lógica lógica de layout para el Dashboard React y la exportación de Excel.

## ADDED Requirements

### Requirement: Matrix transformation to flat row schema
The system SHALL transform raw structured quote data (`QuoteData[]`) into a flat array of matrix rows (`MatrixRow[]`) representing headers, data rows (values, deductibles, inclusions), and spacers.

#### Scenario: Successful transformation of canonical coverages
- **WHEN** the system transforms a quote comparison
- **THEN** it SHALL generate a `MatrixRow` of type 'header' for each active category
- **AND** it SHALL generate a `MatrixRow` of type 'data' for the 'Valor Asegurado' variable under that header
- **AND** it SHALL generate a `MatrixRow` of type 'data' for the 'Deducible' variable under that header
- **AND** it SHALL generate a `MatrixRow` of type 'data' for the 'Incluye' variable under that header
- **AND** the columns of cell values in each data row SHALL correspond exactly to each insurer's quote in order

### Requirement: Exclusive coverages mapping in matrix
The system SHALL identify coverages offered by only one insurer (exclusive coverages) and place them in a dedicated 'Amparos Exclusivos / Ventajas Competitivas' section in the flat row schema.

#### Scenario: Mapping exclusive coverages
- **WHEN** an analysis has coverages with match confidence < 0.65 or no category mapping
- **THEN** the system SHALL group them as exclusive coverages
- **AND** create a dedicated row in the matrix where Column A displays the exclusive coverage name
- **AND** the insurer column that offers it displays its value and deductible details
- **AND** all other insurer columns display 'No incluida' / 'N.C.'

### Requirement: Unified React layout rendering
The frontend React dashboard SHALL render the unifed `MatrixRow[]` schema in a horizontal responsive table using a monochromatic slate and blue styling.

#### Scenario: Render grouped rows in frontend
- **WHEN** the React matrix component receives a list of `MatrixRow` items
- **THEN** header rows SHALL be rendered spanning all columns with a soft blue background (#E6F0FA) and bold blue text (#0066CC)
- **AND** data rows SHALL render the row label in Column A with a soft gray background (#F8FAFC)
- **AND** cells for insurers SHALL display formatted currencies, deductible badges, or italic red 'No incluida' text
- **AND** the layout SHALL alternate row background colors cleanly
