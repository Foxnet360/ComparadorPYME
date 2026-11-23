# ODD Feature: Remediación de Auditoría Integral (Fase 3 — P2)
Rama: `refactor/audit-remediation-p2` | Plan aprobado: `auditoria_y_plan_de_mejora.md` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run lint && npm run test:unit && npm run test:integration`

## Specs
- S1 (Poda de Dependencias, Código Muerto/Duplicado y Formato Prettier): Eliminar dependencias sin uso en `package.json` (`redis`, `dompurify`, `@types/dompurify`, `pdf-parse`, `esbuild`, `@tanstack/react-virtual`) y limpiar `vite.config.ts`; eliminar archivos huérfanos sin consumidores (`utils/stringUtils.ts`, `types/analysis.ts`, `utils/logger.ts`); limpiar ramas `if (!response.ok)` inalcanzables tras `apiClient.fetch` (`useAuditEnrichment.ts`, `geminiService.ts`, `ChatBot.tsx`); unificar formateadores `formatCOP`, helper `brokerInfo`, guard `rejectSpoofedUserId` y remover `optionalAuthMiddleware` redundante bajo `authGate`; lograr `npm run format:check` con 0 advertencias.
- S2 (Observabilidad Pino, Tipado Estricto y Modularización de Monolitos): Migrar llamadas `console.*` en `server/src/routes/` y `server/src/controllers/` a `config/logger.ts`; eliminar warning `ParsedQs` y reducir warnings `@typescript-eslint/no-explicit-any` en módulos core (`analysisController.ts`, `analysisValidationController.ts`, `ExportModal.tsx`, `matrixTransformer.ts`, `reportBuilderService.ts`); dividir de forma segura componentes/servicios monolíticos (`ClauseAdmin.tsx`, `analysisController.ts`) preservando exports y pruebas existentes.
- S3 (Docker Multi-Stage, Documentación y Smoke Tests): Convertir `Dockerfile` en build multi-stage real sin toolchain de compilación ni copia duplicada de tesauros en la imagen final; alinear `README.md` con scripts, modelos Gemini de `env.ts`, endpoints reales y `docs/DEPLOY.md`; reparar `scripts/smoke-tests.sh` contra rutas reales.

## Tasks
- [ ] T1 | S1 | route: inline | status: pending — Poda de dependencias (`package.json`/`vite.config.ts`), eliminación de huérfanos y ramas inalcanzables, unificación `formatCOP`/`brokerInfo`/`rejectSpoofedUserId`, limpieza `optionalAuthMiddleware` y `npm run format:check` en 0 + tests (High Risk: item 5)
- [ ] T2 | S2 | route: inline | status: pending — Migración `console.*` a Pino en routes/controllers, reducción de `no-explicit-any` en módulos core y modularización de `ClauseAdmin.tsx` y `analysisController.ts` + tests (Medium Risk)
- [ ] T3 | S3 | route: inline | status: pending — `Dockerfile` multi-stage, alineación `README.md` y reparación de `scripts/smoke-tests.sh` + verificación sintáctica y tests (High Risk: item 5)

## Log
- L1 (2026-11-22): Merge local de `feat/audit-remediation-p1` en `main` (`4d8e9c0`). Usuario autorizó continuar con Fase 3 (P2) en rama `refactor/audit-remediation-p2`.
