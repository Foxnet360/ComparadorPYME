# Delta Specification: Auditoría Pachito — Matriz de Coberturas

## Domain: unified-coverage-matrix

### Requirement: DeductibleMatrix Shall Only Show Rows with Specified Deductibles

The `DeductibleMatrix` component SHALL only render rows where at least one quote has a deductible that is explicitly specified.

**Scenarios:**
- **Given** two quotes where `Incendio` has deductibles `5% - Mínimo 1 SMMLV` and `5% - Mínimo 1 SMMLV`  
  **When** `DeductibleMatrix` renders  
  **Then** the `Incendio` row SHALL be displayed.

- **Given** two quotes where `Gastos médicos` has deductibles `No especificado` and `No especificado`  
  **When** `DeductibleMatrix` renders  
  **Then** the `Gastos médicos` row SHALL NOT be displayed.

- **Given** one quote has `No especificado` for `Vidrios` and the other has `No aplica`  
  **When** `DeductibleMatrix` renders  
  **Then** the `Vidrios` row SHALL NOT be displayed because neither quote has a specified deductible.

### Requirement: Deductible Tab Shall Not Show Full-Text Fallback

The `Deducibles` tab in `ComparisonReport` SHALL render only the `DeductibleMatrix`; the full-text collapsible block SHALL be removed.

**Scenarios:**
- **Given** a report with two quotes  
  **When** the user selects the `Deducibles` tab  
  **Then** only `DeductibleMatrix` SHALL be visible and no "Texto Completo de Deducibles" section SHALL be rendered.

### Requirement: Coverage Matrix DEDUCIBLES Section Shall Group All Deductible Rows

`UnifiedCoverageMatrix` SHALL group all rows whose label is a deductible row into a single `DEDUCIBLES` business section, regardless of the underlying coverage category.

**Scenarios:**
- **Given** the matrix contains deductible rows for `Todo Riesgo Incendio`, `Anegación / Cobertura Extendida`, `Terremoto`, `HMACC-AMIT`, and `RCE`  
  **When** `UnifiedCoverageMatrix` renders the `Coberturas y Deducibles` tab  
  **Then** all deductible rows SHALL appear under the `DEDUCIBLES` section header.

- **Given** a deductible row for `Todo Riesgo Incendio` was previously placed under `BIENES ASEGURADOS`  
  **When** the new grouping is applied  
  **Then** it SHALL be moved under `DEDUCIBLES`.

### Requirement: Dashboard View Mode Shall Always Be Technical

`ComparisonReport` SHALL always render in technical mode. No client/technical toggle SHALL be rendered.

**Scenarios:**
- **Given** any report  
  **When** `ComparisonReport` renders  
  **Then** `viewMode` SHALL be `'technical'` and no toggle buttons SHALL be present in the header.

- **Given** the previous deployment showed a `Cliente / Técnico` toggle  
  **When** the current source is deployed  
  **Then** the toggle SHALL no longer be visible.
