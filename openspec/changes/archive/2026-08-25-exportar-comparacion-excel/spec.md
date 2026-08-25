# Specification: Exportar Comparación a Excel

## MODIFIED SPECIFICATION

### Requirement 1: Estructura del Libro Excel en 5 Pestañas
The Excel generation service SHALL export a 5-sheet workbook containing the complete audit comparison.

#### Scenario: 1.1 Ocultar líneas de cuadrícula y aplicar tipografía ejecutiva
- **GIVEN** a completed comparison analysis with evaluated quotes
- **WHEN** the user requests the Excel export
- **THEN** the generator SHALL set `showGridLines: false` on all 5 worksheets
- **AND** the generator SHALL apply `Segoe UI` font with Navy `#1E3A8A` headers and bold white text across all tables.

---

### Requirement 2: Portada Ejecutiva y Scorecard
The first sheet `Portada y Resumen General` SHALL present an executive cover and 0-100 scorecard.

#### Scenario: 2.1 Párrafo de recomendación y datos del cliente
- **GIVEN** client metadata and evaluated quotes
- **WHEN** sheet 1 is constructed
- **THEN** the generator SHALL create a shaded summary box (`#F8FAFC`) with a thick Navy left border containing the executive recommendation paragraph
- **AND** the generator SHALL display the client details, broker details, and the 0-100 score breakdown per dimension.

---

### Requirement 3: Matriz Coberturas Paritaria con la Web
The second sheet `Matriz Coberturas` SHALL render coverage rows directly from the ground-truth `MatrixRow[]` object.

#### Scenario: 3.1 Agrupación en secciones y formato semáforo RAG
- **GIVEN** the pre-aligned matrix rows from the backend/web UI
- **WHEN** sheet 2 is rendered
- **THEN** the generator SHALL group rows into business sections (`BIENES ASEGURADOS`, `COBERTURAS`, `SUSTRACCIÓN`, `AMPAROS EXCLUSIVOS`)
- **AND** covered cells SHALL be highlighted in soft green (`#DEF7EC`), excluded cells in soft red (`#FDE8E8`), and winning options in soft amber (`#FEF3C7`).

---

### Requirement 4: Matriz Consolidada de Deducibles
The third sheet `Matriz Deducibles` SHALL detail deductible terms per coverage category.

#### Scenario: 4.1 Enriquecimiento monetario en COP y exención de deducible
- **GIVEN** raw deductible strings from parsed quotes
- **WHEN** sheet 3 is rendered
- **THEN** SMMLV expressions SHALL be enriched with COP currency estimates
- **AND** "Sin deducible / No aplica" cells SHALL be highlighted in soft green (`#DEF7EC`).

---

### Requirement 5: Evaluación Financiera con Fórmulas Nativas
The fourth sheet `Primas y Costos` SHALL execute financial calculations using native Excel formulas.

#### Scenario: 5.1 Fórmulas automáticas e indicador visual
- **GIVEN** annual net premiums and issuance expenses
- **WHEN** sheet 4 is rendered
- **THEN** Subtotal SHALL use `{ formula: 'SUM(B5:B6)' }`, IVA 19% SHALL use `{ formula: 'ROUND(B7*0.19, 0)' }`, Total to Pay SHALL use `{ formula: 'B7+B8' }`, and % Asset Ratio SHALL use `{ formula: 'B9/maxAsset' }` formatted as `0.00%`
- **AND** a visual bar indicator (`█████████`) SHALL mark the lowest cost option in green and highest in red.

---

### Requirement 6: Auditoría de Riesgos y Escala Condicional 1 a 10
The fifth sheet `Análisis de Riesgos` SHALL detail audited risk alerts and a 1 to 10 technical score.

#### Scenario: 6.1 Gradiente de calificación y tabla de alertas
- **GIVEN** calculated quote scores and audited risk alerts
- **WHEN** sheet 5 is rendered
- **THEN** the technical rating column (1 to 10) SHALL use a 3-tier color scale (8-10 Green, 6-7 Yellow, 1-5 Red)
- **AND** alerts (`CRITICAL`, `WARNING`, `GOOD`) SHALL be listed with clause references and source documents.
