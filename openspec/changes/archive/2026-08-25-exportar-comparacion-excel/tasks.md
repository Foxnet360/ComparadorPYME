# Tasks: Exportar Comparación a Excel

## Phase 1: Data Pipeline & Ground-Truth Matrix Binding

- [x] **Task 1.1**: Attach `matrix: matrixRows` to the return object of `matrixRowsToComparisonReport` in `server/src/controllers/analysisController.ts`.
- [x] **Task 1.2**: Update `handleExportExcel` in `components/UnifiedCoverageMatrix.tsx` to pass `matrix: rows` in the POST request body.
- [x] **Task 1.3**: Update `exportAnalysisExcel` handler in `server/src/controllers/analysisValidationController.ts` to extract `matrix` and pass it into `generateExcelBuffer`.

## Phase 2: Excel Generator 5-Sheet Executive Overhaul

- [x] **Task 2.1**: Implement `Portada y Resumen General` sheet with executive recommendation box, client/broker metadata, and 0-100 pastel RAG scorecard.
- [x] **Task 2.2**: Implement `Matriz Coberturas` sheet directly rendering ground-truth `MatrixRow[]` with business section grouping, RAG highlights, and PDF citations.
- [x] **Task 2.3**: Implement `Matriz Deducibles` sheet with SMMLV-to-COP enrichment and soft green exención highlights.
- [x] **Task 2.4**: Implement `Primas y Costos` sheet with native Excel formulas (`SUM`, `ROUND`, `MIN`, `% Asset`) and relative visual cost bars.
- [x] **Task 2.5**: Implement `Análisis de Riesgos` sheet with 1 to 10 technical score gradient scale and audited risk alerts table.

## Phase 3: Testing & Production Deployment

- [x] **Task 3.1**: Verify unit test suite in `server/src/services/__tests__/excelGenerator.test.ts` (17/17 tests passing).
- [x] **Task 3.2**: Execute production build check (`npm run build`) and deploy commit to Railway.
