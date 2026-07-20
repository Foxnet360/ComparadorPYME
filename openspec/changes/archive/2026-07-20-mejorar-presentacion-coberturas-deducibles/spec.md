# Delta Specification: Mejorar Presentación de Coberturas y Deducibles

## 1. Domain: unified-coverage-matrix

### Requirement: V2 Granular Extraction by Default & 14-Coverage Taxonomy
The backend SHALL execute extraction using the V2 granular schema by default via the `granularComparisonSchema` feature flag set to `true`. The extraction prompt builder MUST include exactly the 14 standard canonical coverages.
(Previously: extraction was V1 flat by default, and V2 only mapped a subset of coverages.)

#### Scenario: V2 granular extraction by default
- GIVEN the `granularComparisonSchema` feature flag is true
- WHEN a comparison analysis is triggered for a PDF
- THEN the system SHALL execute the expanded V2 granular extraction prompt
- AND return structured data containing the 14 canonical coverages and deductibles

#### Scenario: Fallback to V1 flat extraction
- GIVEN the `granularComparisonSchema` feature flag is false
- WHEN a comparison analysis is triggered
- THEN the system SHALL fall back to V1 flat extraction layout

---

### Requirement: Frontend Coverage Grid side-by-side Presentation
The frontend `UnifiedCoverageMatrix` SHALL display the 14 canonical coverages side-by-side for comparison.
(Previously: rows were client-side reconstructed and did not support direct backend pre-aligned rows.)

#### Scenario: Side-by-side coverage display
- GIVEN a generated comparison report with V2 granular data
- WHEN the user views the "Coberturas" matrix
- THEN the frontend SHALL render 14 canonical coverages in a structured grid
- AND each insurer's value MUST be aligned side-by-side in separate columns

---

### Requirement: Legacy Report Fallback
The frontend SHALL fallback gracefully to V1 layout if the report does not have `schemaVersion === 2`.
(Previously: no standard version checks existed for legacy vs granular reports.)

#### Scenario: Render legacy report
- GIVEN a cached report with `schemaVersion` not equal to 2
- WHEN the user opens the report
- THEN the interface SHALL render using the V1 flat table layout gracefully

---

## 2. Domain: deductible-matrix

### Requirement: Frontend Deductible Grid Presentation
The frontend `DeductibleMatrix` SHALL render a structured, clean grid of deductibles across all insurers with risk indicators.
(Previously: the matrix displayed poorly structured cells.)

#### Scenario: Side-by-side deductible comparison
- GIVEN a comparison report with V2 deductible details
- WHEN the user opens the "Deducibles" tab
- THEN the system SHALL show Sum Insured, Deductible, and Sublimits in a clean grid
- AND color-code cells by risk (green, yellow, red) based on nominal or effective risk values

---

### Requirement: Unspecified Deductible Metrics & Summary Card Fix
The system SHALL parse and count unspecified deductibles using case-insensitive validation.
(Previously: case mismatch `"No especificado"` vs `"NO ESPECIFICADO"` broke the summary card and scoring.)

#### Scenario: Case-insensitive count of unspecified deductibles
- GIVEN a report with deductibles like "No especificado" or "NO ESPECIFICADO"
- WHEN the deductible summary card and metrics dashboard are loaded
- THEN the frontend SHALL recognize them as unspecified case-insensitively
- AND display the correct count of unspecified deductibles and calculate accurate ranking scores

---

## 3. Domain: deductible-semantic-parser

### Requirement: SMMLV Normalization with Dots Tolerance
The parser SHALL normalize dots-containing variations of SMMLV (`S.M.M.L.V.`, `S.M.M.L.V`, etc.) to `SMMLV` before performing regex and LLM extraction.
(Previously: only exact "SMMLV" matches were parsed correctly, causing parsing errors on dotted formats.)

#### Scenario: Normalize dotted SMMLV variations
- GIVEN a deductible text containing "5 S.M.M.L.V." or "10 S.M.M.L.V"
- WHEN the text is processed by `hybridDeductibleParser`
- THEN the parser SHALL normalize the token to "SMMLV"
- AND successfully parse and calculate the minimum amount based on the current SMMLV value

---

## 4. Non-Functional Requirements

### Requirement: Matrix Rendering Performance
The frontend matrix SHALL render and scroll fluidly with an interaction time under 100ms.

#### Scenario: Smooth scrolling with virtualization
- GIVEN a comparison matrix with >100 cells
- WHEN the user scrolls or switches tabs
- THEN the interface SHALL maintain a frame rate of at least 60fps using virtualized rows

### Requirement: Accessibility Standards
The grid SHALL maintain keyboard focus and proper ARIA labeling.

#### Scenario: Keyboard navigation in matrix
- GIVEN the matrix is focused
- WHEN the user presses arrow keys
- THEN the active cell focus MUST shift logically with clear visual focus indicators
