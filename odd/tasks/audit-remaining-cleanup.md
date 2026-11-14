# Audit Remaining Cleanup (Fases 2.3, 3.3, 4.1)
Feature: Complete remaining items from `informe_auditoria_proyecto.md`
Branch: `main`

## Specs
- S1 (2.3 Client Forms): Consolidate client creation/editing forms (`components/ClientManager.tsx` and `components/clients/NewClientModal.tsx` used by `components/ClientSelector.tsx`) into a shared reusable component/form without losing geocoding, predictive municipality search, or `domainDetails` support.
- S2 (3.3a UnifiedCoverageMatrix): Modularize `components/UnifiedCoverageMatrix.tsx` (~1,431 lines) into focused sub-modules/components while preserving all existing exported symbols and passing all existing tests.
- S3 (3.3b pdfService): Modularize `services/pdfService.ts` (~1,349 lines) into focused sub-modules while preserving `BrokerInfo`, `PDFOptions`, `generatePDF`, and `generatePerformanceReport` exports and passing all existing tests.
- S4 (3.3c excelGenerator): Modularize `server/src/services/excelGenerator.ts` (~1,999 lines) into focused sub-modules while preserving `ClientInfo`, `ExcelReportData`, `BrokerInfo`, `formatRatioCell`, and `generateExcelBuffer` exports and passing all existing tests.
- S5 (3.3d quoteProcessingService): Modularize `server/src/services/quoteProcessingService.ts` (~1,292 lines) into focused sub-modules while preserving all exported symbols and passing all existing tests.
- S6 (4.1 PGVector & Migrations): Establish and document/implement the canonical migration source of truth and `pgvector` indexing strategy (evaluating `halfvec`/MRL HNSW vs exact scan on `vector(3072)` and eliminating dual-directory drift without breaking CI).

## Tasks
- [x] T1 | S1 | route: inline | commit: 81b75d4 — Consolidate `ClientManager.tsx` and `NewClientModal.tsx` shared client form + unit tests
- [x] T2 | S2 | route: delegated (writer-matrix, parallel unit) | commit: 3a1519f — Modularize `components/UnifiedCoverageMatrix.tsx`
- [x] T3 | S3 | route: delegated (writer-pdf, parallel unit) | commit: 3a1519f — Modularize `services/pdfService.ts`
- [x] T4 | S4 | route: delegated (writer-excel, parallel unit) | commit: c042844 — Modularize `server/src/services/excelGenerator.ts`
- [x] T5 | S5 | route: delegated (writer-quote, parallel unit) | commit: c042844 — Modularize `server/src/services/quoteProcessingService.ts`
- [x] T6 | S6 | route: inline | commit: 81b75d4 — Consolidate SQL migration source of truth & document/apply PGVector indexing strategy

## Log
- L1: User request: "Avancemos con todos los pendientes. Debes garantizar que todo quede terminado."
