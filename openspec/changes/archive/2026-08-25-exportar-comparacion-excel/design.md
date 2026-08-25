# Design Document: Exportar Comparación a Excel

## Architecture Overview

```
[Web UI / UnifiedCoverageMatrix.tsx]
       │  POST /api/analysis/:id/export { matrix: rows, quotes, cellNotes, domain }
       ▼
[analysisValidationController.ts]
       │  Extracts ground-truth matrix, quotes, client & broker info
       ▼
[excelGenerator.ts] ──► Uses ExcelJS Workbook
       │
       ├─► Sheet 1: Portada y Resumen General (Cover, Executive Box, Scorecard 0-100)
       ├─► Sheet 2: Matriz Coberturas (MatrixRow[] direct rendering, RAG pastels, PDF citations)
       ├─► Sheet 3: Matriz Deducibles (Enriched COP, Soft Green No-Deductible highlights)
       ├─► Sheet 4: Primas y Costos (Native Formulas: SUM, ROUND, MIN, % Asset, Visual Bar Chart)
       └─► Sheet 5: Análisis de Riesgos (Grade 1-10 3-Tier Gradient Scale, Audited Alerts)
       │
       ▼
[Excel Buffer (.xlsx)] ──► Streamed to client as attachment
```

## Key Decisions & Tradeoffs

1. **Ground-Truth Matrix Binding vs. Dynamic Re-Parsing**:
   - *Decision*: Pass and bind `reportData.matrix` (`MatrixRow[]`) directly from the active analysis session instead of dynamically re-parsing quotes on export.
   - *Rationale*: Eliminates discrepancies between web dashboard and Excel output, ensuring 100% data parity.

2. **Native Excel Formulas for Financial Calculations**:
   - *Decision*: Write `{ formula: 'SUM(B5:B6)' }`, `{ formula: 'ROUND(B7*0.19, 0)' }`, and `{ formula: 'B7+B8' }` in sheet 4.
   - *Rationale*: Allows financial analysts to modify base premiums or expenses in Excel while auto-updating subtotal, tax, and totals natively.

3. **Pastel Color Palette (Tailwind RAG)**:
   - *Decision*: Replace harsh primary colors with soft pastel fill colors (`#DEF7EC` Emerald 100, `#FEF08A` Yellow 200, `#FDE8E8` Red 100, `#FEF3C7` Amber 100).
   - *Rationale*: Delivers a clean, executive software report aesthetic with high contrast and legibility.

## Modified Files

- `server/src/controllers/analysisController.ts`: Attaches `matrix: matrixRows` to `UnifiedComparisonReport`.
- `components/UnifiedCoverageMatrix.tsx`: Passes `matrix: rows` in POST body to `/analysis/:id/export`.
- `server/src/controllers/analysisValidationController.ts`: Extracts `matrix` from request body/analysis result and passes it to `generateExcelBuffer`.
- `server/src/services/excelGenerator.ts`: Renders 5-sheet workbook directly from ground-truth matrix.
