# Delta Specs: Mejorar Matriz Coberturas

This delta spec aligns PDF extraction and frontend rendering with the PYME business template.

---

# Delta for Unified Comparison Extraction

## MODIFIED Requirements

### Requirement: Single-call multimodal comparison

The system SHALL process N quote PDFs in a single Gemini call and request a section-aware comparison. Prompt builder MUST suggest business sections (Bienes Asegurados, Todo Riesgo Daños Materiales with deductibles, Sustracción con Violencia, Financial Footer) and the engine MUST extract quote-level header metadata: Cliente, Tipo de Seguro, Ubicación del Riesgo, Año Construcción, Pisos, Aliado, Actividad/Ocupación, Documento, Vigencia.

(Previously: requested granular table with standard sub-rows but no header metadata or suggested business sections.)

#### Scenario: Successful comparison & metadata extraction
- GIVEN 4 quote PDFs with diverse business coverages and risk details
- WHEN system triggers a single-call comparison with section suggestions
- THEN it SHALL receive a granular table response within 60 seconds
- AND extract the 9 header metadata fields for each quote

#### Scenario: Coverage equivalence & deductible parsing
- GIVEN differing insurer names (e.g., "Eq. Eléctrico") and deductible texts
- WHEN flat table parsing, normalization, and deductible structuring run
- THEN equivalent labels map to same canonical row, preserving raw wording
- AND deductible text extracts to structured JSON (e.g., percentage, minimum)

#### Scenario: Exclusive coverage detection
- WHEN an insurer offers a unique coverage not found in other quotes
- THEN system SHALL mark it as exclusive and note it in the analysis

### Requirement: Section assignment

The system SHALL assign every canonical row to a section. Flat table parser MUST classify labels:

| Section | Canonical Labels |
|---|---|
| BIENES ASEGURADOS | Mercancías, Muebles y enseres, Maquinaria y equipo, Equipo eléctrico y electrónico, Asistencia |
| DEDUCIBLES | Todo Riesgo Incendio, Anegación / Cobertura Extendida, Terremoto, HMACC-AMIT (grouped under parent) |
| SUSTRACCIÓN | Sustracción con Violencia |
| FINANCIAL | Prima con IVA incluido, Gastos de expedición, IVA, Total prima, Forma de pago (tagged with consistent ID) |

(Previously: assigned rows to generic sections without precise mapping or a financial section ID.)

#### Scenario: Section classification from labels
- GIVEN raw labels "Prima con IVA incluido" or "HMACC-AMIT"
- WHEN parser normalizes and assigns sections
- THEN "Prima con IVA incluido" maps to FINANCIAL with consistent section ID
- AND "HMACC-AMIT" maps to DEDUCIBLES

## ADDED Requirements

### Requirement: Aligned matrix API payload
The API response SHALL include pre-aligned `MatrixRow[]` in `ComparisonReport` for direct frontend rendering.

#### Scenario: API payload with matrix field
- GIVEN a valid comparison report
- WHEN served via `/api/comparison/unified`
- THEN payload MUST include pre-aligned `matrix` rows

---

# Delta for Unified Coverage Matrix

## MODIFIED Requirements

### Requirement: Matriz de comparación unificada

The frontend SHALL render comparison in a matrix of granular rows. It MUST pass backend `matrix` to `UnifiedCoverageMatrix` and render a responsive Header Metadata Card with the 9 extracted fields. If backend `matrix` is absent, it MUST fall back to client-side construction with the same grouping logic.

(Previously: rendered a granular matrix by ignoring the backend `MatrixRow[]` and reconstructing it client-side without a metadata card.)

#### Scenario: Matrix visualization & cell actions
- WHEN user views Coberturas tab or triggers cell actions
- THEN table shows sections with granular rows, preserving canonical order
- AND cells display values with confidence badges, clickable citations, or double-click inline notes editor

#### Scenario: Backend matrix & header metadata card
- GIVEN report with pre-aligned backend matrix and header metadata
- WHEN rendered
- THEN `UnifiedCoverageMatrix` MUST use backend rows directly
- AND render responsive Header Metadata Card with all 9 fields at top

#### Scenario: Fallback client-side grouping & tab filtering
- GIVEN report with no backend `matrix`
- WHEN rendered or filtered by tabs
- THEN it SHALL fall back to client-side grouping (Bienes, Deducibles, Sustracción, Financial)
- AND financials tab MUST map the backend financial section ID
- AND deductibles group under parent category when provided
