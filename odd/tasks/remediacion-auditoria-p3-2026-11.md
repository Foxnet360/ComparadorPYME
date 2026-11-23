# ODD Feature: Remediación de Auditoría Integral (Fase 4 — P3)

Rama: `feat/audit-remediation-p3` | Plan aprobado: `auditoria_y_plan_de_mejora.md` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run lint && npm run test:unit && npm run test:integration`

## Specs

- S1 (Versionado `/api/v1/*` y OpenAPI 3.x Unificado): Versionar `/api/v1/*` para la API principal preservando retrocompatibilidad en `/api/*` y cobertura `authGate` (`routeAuthCoverage.test.ts`); generar OpenAPI 3.x unificado (`docs/openapi.yaml` + endpoint de consulta `/api/v1/openapi.json` / `/api/openapi.json`) y alinear `docs/daas-openapi.yaml` (incluyendo `/subscriber/status` y envoltura `{ success, data }`).
- S2 (Rate Limiting DaaS por Suscriptor, Métricas Reales y Webhooks de Salida): Enforcer real por suscriptor de `rateLimitPerMinute` en DaaS (respaldado por `redisCache` con fallback en memoria y exento del límite IP global de `100/15min` que bloqueaba `ENTERPRISE`); métricas reales de conversión (`ACCEPTED`/`SOLD`) y `totalPremium` tanto en `analyticsAggregationService.ts` como en migración SQL RPC `037`; tablas y servicio de webhooks de salida (`webhook_subscriptions`, `webhook_deliveries`) con firma HMAC-SHA256, validación anti-SSRF, reintentos con backoff e idempotencia, conectados a eventos de análisis y renovación.
- S3 (Escalabilidad de Matriz > 150 Filas): Activar windowing/virtualización real en `UnifiedCoverageMatrix.tsx` cuando `filteredRows.length > 150` (preservando sticky header, columna A sticky, `role="grid"` y sublímites colapsables, sin romper el render directo de matrices `<= 150` filas) + pruebas con > 150 filas.
- S4 (Cola Asíncrona para Análisis PDF Largos con Progreso y Cancelación): Desacoplar análisis PDF largos mediante cola de trabajos asíncrona (`analysisJobQueue.ts` con `redisCache`/fallback en memoria) activada por `Prefer: respond-async` o `POST /api/analysis/jobs` (`/api/v1/...`) devolviendo `202 Accepted` con `jobId`, polling (`GET .../jobs/:jobId`), stream SSE de progreso por etapa (`GET .../jobs/:jobId/events`) y cancelación (`POST .../jobs/:jobId/cancel` con limpieza de archivos), preservando retrocompatibilidad síncrona por defecto; integrar progreso real por etapa y botón de cancelación en `geminiService.ts`, `useAnalysisFlow.ts` y `AnalyzerPage.tsx`.

## Tasks

- [x] T1 | S1 | route: inline | status: done | commit: 2b20703 — Versionado `/api/v1/*` en `server/src/index.ts`/`authGate.ts`, `docs/openapi.yaml` unificado, alineación `docs/daas-openapi.yaml` y endpoint OpenAPI + tests (High Risk: item 2)
- [x] T2 | S2 | route: inline | status: done | commit: bd796b4, eefa9e6 — Rate limiter por suscriptor DaaS, migración `037` + métricas reales `ACCEPTED`/`SOLD`/`totalPremium`, y servicio/rutas de webhooks de salida HMAC + tests (High Risk: items 1, 2)
- [x] T3 | S3 | route: inline | status: done | commit: bd6796c — Virtualización/windowing en `UnifiedCoverageMatrix.tsx` para > 150 filas + tests de escalabilidad y DOM acotado (Medium Risk)
- [x] T4 | S4 | route: inline | status: done | commit: aecbb0b, f1f3909 — Cola asíncrona de análisis PDF (`analysisJobQueue.ts`, SSE/polling/cancel) y soporte en `geminiService.ts`/`useAnalysisFlow.ts`/`AnalyzerPage.tsx` + tests (High Risk: item 4)

## Log

- L1 (2026-11-23): Usuario respondió "Si, merge" -> merge local `--no-ff` de `refactor/audit-remediation-p2` en `main` (`4c8e42d`). Luego usuario autorizó "Continuar" -> creada rama `feat/audit-remediation-p3` para Fase 4 (P3).
- L2 (2026-11-23): Fase 4 (P3) completada y verificada en `feat/audit-remediation-p3` (`2b20703` T1 PASS, `bd796b4`+`eefa9e6` T2 PASS tras hardening SSRF IPv6/DNS/redirects, `bd6796c` T3, `aecbb0b`+`f1f3909` T4 PASS tras fix CORS `Prefer` y exención polling en rate limiter). Gate completo PASS: `format:check` (0 warnings), `typecheck:backend`/`frontend` (0 errores), `build` (`✓ built in 2.08s`), `lint` (0 errores, 129 warnings), `test:unit` (249/249 files, 2017 passed | 8 skipped), `test:integration` (24/24 files, 257 passed | 2 skipped). Pendiente autorización del usuario para merge local en `main` (y eventual push si lo desea).
