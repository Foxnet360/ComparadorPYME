# ODD Feature: Remediación de Auditoría Integral (Fase 2 — P1)
Rama: `feat/audit-remediation-p1` | Plan aprobado: `auditoria_y_plan_de_mejora.md` | Estrategia de entrega: `single-pr` | Runner: `npm run test:unit && npm run test:integration`

## Specs
- S1 (Integridad de Navegación, Estilos y Estado en Frontend): Incluir `pages/`, `src/`, `contexts/` en `tailwind.config.cjs` y definir `animate-progress`; agregar guard de sesión autenticada y fallback de `/report` sin reporte en `App.tsx`; usar clave estable por análisis/cotizaciones en `hooks/useAuditEnrichment.ts`; corregir coordenadas viewport, `URL.revokeObjectURL` y `destroy()` en `PdfViewer.tsx` / `UnifiedCoverageMatrix.tsx`; priorizar logo personalizado en `ExportModal.tsx` / `pdfHeader.ts`; evitar colapso accidental en `ClauseSelector.tsx`; dar feedback de archivos rechazados, limpiar `input.value` y asegurar `id` único en `FileUploader.tsx`; agregar `try/catch/finally` con error visible en `ClientManager.tsx`, `UserManagement.tsx`, `InsurerManager.tsx` y `TechnicalDashboard.tsx`.
- S2 (Accesibilidad, Responsive y Consistencia de Copy): Crear `components/common/Modal.tsx` accesible (`role="dialog"`, `aria-modal`, `Escape`) y migrar `ConfirmModal`, `ClauseAdmin` (con preview dinámico real y `overflow-x-auto`), `ExportModal`, `ChatBot`, `PdfViewer`; reemplazar `<div>` clicables por `<button>`, agregar `aria-label` y menú móvil en `AppHeader.tsx` y `ClientSelector.tsx`; estandarizar copy a español neutro profesional (sin voseo) y mapear estados legibles en `pages/RenewalDetail.tsx`.
- S3 (Confiabilidad Backend, Gemini y Renovaciones):
  - S3a (Shutdown & Gemini): Manejar `SIGTERM`/`SIGINT` en `server/src/index.ts`; centralizar `getGenAI()` y modelos desde `env.ts` eliminando hardcodes en `unifiedComparisonEngine.ts`, `chatService.ts`, extractores, `semanticMatcher.ts`, `monitoring.ts`, `comparisonRoutes.ts`; capturar `usageMetadata` real de Gemini en `chatService.ts` y `unifiedComparisonEngine.ts`.
  - S3b (Renovaciones & Scheduler): Propagar `org_id` y `role` en `renewalDetection.ts`, `campaignService.ts`, `analysisController.ts`; propagar `referenceQuote` (`isBaseline`) en todos los caminos de `comparisonEngineAdapter.ts`; revertir/marcar fallos en `campaign_deliveries` cuando `notifier.send` falla tras insertar `'pending'` para permitir reintentos.

## Tasks
- [x] T1 | S1 | route: inline | status: done | commit: 47cff21 — Integridad Tailwind, guard de rutas en `App.tsx`, `useAuditEnrichment`, `PdfViewer`, `ExportModal`/`pdfHeader`, `ClauseSelector`, `FileUploader` y manejo de errores en managers + tests (Medium Risk)
- [x] T2 | S2 | route: inline | status: done | commit: 2b07754 — Componente `Modal` accesible, responsive móvil en `AppHeader`/`ClauseAdmin`/`ExportModal`, `<button>`/`aria-label`, preview real en `ClauseAdmin`, copy neutro y etiquetas en `RenewalDetail` + tests (Medium Risk)
- [x] T3 | S3a | route: inline | status: done | commit: c242323 — `SIGTERM`/`SIGINT` en `index.ts`, unificación `getGenAI()` + modelos desde `env` y captura de `usageMetadata` real en Gemini + tests (Medium Risk)
- [ ] T4 | S3b | route: inline | status: pending — `org_id` en renovaciones, `referenceQuote` en todos los caminos de `comparisonEngineAdapter.ts` y recuperación ante fallo de envío en `campaignService.ts` + tests (High Risk: item 3/4)

## Log
- L1 (2026-11-22): Merge de `fix/audit-remediation-p0` completado en `main` (`a2e6e16`). Usuario autorizó continuar con Fase 2 (P1) en rama `feat/audit-remediation-p1`.
