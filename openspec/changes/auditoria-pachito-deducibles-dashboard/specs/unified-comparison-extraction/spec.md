# Delta Specification: Auditoría Pachito — Extracción Unificada

## Domain: unified-comparison-extraction

### Requirement: Financial Rows Must Map to Financial Section

The V2 granular comparison engine SHALL emit financial rows with `sectionId: 100` so the analysis controller can extract premiums and skip them during coverage matching.

**Scenarios:**
- **Given** a V2 granular result contains a row labeled `Prima con IVA incluido`, `IVA`, `Total prima`, `Forma de pago`, or `Gastos de expedición`  
  **When** `flatResultToMatrixRowsV2` builds the matrix  
  **Then** the row SHALL have `sectionId: 100` and appear under the `PRIMAS Y COSTOS` header.

- **Given** the same row is returned as an `extraRow` from `flatTableParser.parseV2` with `section: FINANCIAL`  
  **When** the transformer groups extra rows  
  **Then** the row SHALL be treated as financial and receive `sectionId: 100`.

### Requirement: Premium Extraction Must Use Parsed Currency Values

The analysis controller SHALL parse the cell value of any financial row labeled with a premium-related keyword and assign `priceAnnual` to the matching quote.

**Scenarios:**
- **Given** a financial row with `sectionId: 100` and label `Total prima` contains the value `$ 1.234.567`  
  **When** `matrixRowsToComparisonReport` processes the matrix  
  **Then** the quote `priceAnnual` SHALL be `1234567`.

- **Given** no financial rows contain a parseable currency value  
  **When** the report is generated  
  **Then** `priceAnnual` SHALL remain `0` and the dashboard SHALL display "No disponible" for savings.

### Requirement: Deductible Prompt Must Request All Deductible Rows

The V2 comparison prompt SHALL request deductibles for every category listed in the granular DEDUCIBLES section and SHALL NOT suggest the model can omit rows that exist in the quotes.

**Scenarios:**
- **Given** the V2 prompt is built for two quotes  
  **When** the prompt text is inspected  
  **Then** the DEDUCIBLES business rule SHALL list the same rows as the granular `GRANULAR_SECTIONS.DEDUCIBLES` array and SHALL instruct the model to include every deductible present in the quotes.

- **Given** a quote contains a deductible for `Todo Riesgo Incendio`  
  **When** the LLM response is parsed  
  **Then** the result SHALL contain a `DEDUCIBLES` row with that label and a structured `deductible` object.

### Requirement: Unmapped Financial Labels Must Not Be Treated as Coverages

The analysis controller SHALL skip any matrix row with `sectionId: 100` and SHALL NOT call the semantic matcher for it.

**Scenarios:**
- **Given** a row with `sectionId: 100` labeled `Forma de pago`  
  **When** `matrixRowsToComparisonReport` iterates over matrix rows  
  **Then** it SHALL NOT be passed to `semanticMatcher.matchCoverage`.

- **Given** a row with `sectionId: 100` labeled `Prima con IVA incluido`  
  **When** the report is built  **Then** it SHALL NOT appear as a coverage entry in `quote.coverages`.
