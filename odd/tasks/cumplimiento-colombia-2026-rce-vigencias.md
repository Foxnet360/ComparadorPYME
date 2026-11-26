# ODD Feature: Pre-póliza Cumplimiento Colombia 2026 (Vigencias Hábiles, TRM USD/COP, Calidad Contractual/Post-contractual y RCE SMMLV)

Rama: `feat/cumplimiento-colombia-2026-rce-vigencias` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run typecheck:backend && npm run typecheck:frontend && npm run test:unit`

## Specs

- S1 (Calendario Hábil 2026, TRM y Tipos): `server/src/utils/colombianCalendar.ts` + `utils/colombianCalendar.ts` (`COLOMBIA_SMMLV_2026 = 1_750_905`, 19 festivos 2026, días hábiles L–V/sábados, fecha inicio = contrato/firma/hoy, vigencias post-contractuales desde fin de contrato), `server/src/services/trmService.ts` (`datos.gov.co` + caché diario) y tipos extendidos en `server/src/types/cumplimientoCase.ts` y `types.ts`.
- S2 (Extractor 2026, Calidad Split, RCE Independiente SMMLV y Ruta TRM): `server/src/services/governingDocumentExtractor.ts` (fix `220k` chars + schema estricto + parseo COP + desdoblamiento Calidad Contractual/Post-contractual + RCE independiente con PLO y 7 adicionales en SMMLV + fechas exactas), `server/src/services/cumplimientoAuditService.ts` (`calculateDecreto1082RceMinSmmlv` tabla Art. 2.2.1.2.3.1.17) y `GET /api/cumplimiento/trm` en `server/src/routes/cumplimientoRoutes.ts`.
- S3 (UI Editable y Exportación PDF/Word/Clipboard): `services/cumplimientoService.ts`, `components/cumplimiento/CumplimientoCaseDetail.tsx` (selector COP/USD/BOTH + TRM oficial editable, Dirección/Teléfono ambas partes, cálculo automático de fechas hábiles/calendario, tabla Cumplimiento con fase y fechas, sección independiente RCE SMMLV con PLO + 7 adicionales) y `utils/cumplimientoSlipExport.ts` (PDF, Word `.docx` y Correo/WhatsApp).
- S4 (Verificación Integral): `npm run format:check && npm run lint && npm run typecheck:backend && npm run typecheck:frontend && npm run test:unit`.

## Tasks

- [x] T1 | S1 | route: inline | status: done | commit: e4d2084 — Calendario hábil Colombia 2026 (`server/src/utils/colombianCalendar.ts` + `utils/colombianCalendar.ts`), `trmService.ts` y tipos extendidos (`server/src/types/cumplimientoCase.ts`, `types.ts`) + tests (5/5 `colombianCalendar.test.ts`, typecheck backend/frontend PASS)
- [x] T2 | S2 | route: inline | status: done | commit: 328c617 — Extractor Colombia 2026 (`governingDocumentExtractor.ts`), tabla RCE Art. 2.2.1.2.3.1.17 (`cumplimientoAuditService.ts`) y `GET /api/cumplimiento/trm` (`cumplimientoRoutes.ts`) + tests (5/5 archivos, 25/25 tests PASS, typecheck backend PASS) (Risk: item 3 contratos compartidos)
- [x] T3 | S3 | route: inline | status: done | commit: 64f1a5b — UI editable (`CumplimientoCaseDetail.tsx`), `cumplimientoService.ts` y exportadores (`cumplimientoSlipExport.ts`) + tests (4/4 archivos, 25/25 tests PASS, typecheck frontend PASS) (Risk: item 3 contratos compartidos)
- [x] T4 | S4 | route: inline | status: done — Verificación integral: `format:check` PASS, `lint` PASS, `typecheck:backend` PASS, `typecheck:frontend` PASS, `test:unit` 256/256 archivos (2056 passed | 8 skipped)

## Log

- L1 (2026-11-26): Usuario aprobó el plan detallado para evolucionar Cumplimiento al contexto Colombia 2026 (`SMMLV $1.750.905`, calendario hábil 19 festivos, TRM oficial USD/COP, Dirección/Teléfono, Calidad Contractual/Post-contractual y RCE independiente en SMMLV).
- L2 (2026-11-26): Completados T1 (`e4d2084`), T2 (`328c617`), T3 (`64f1a5b`) y T4 (`format:check`, `lint`, `typecheck:backend`, `typecheck:frontend`, `test:unit`: 256 archivos, 2056 passed / 8 skipped). Rama `feat/cumplimiento-colombia-2026-rce-vigencias` lista para revisión/merge a `main`.
