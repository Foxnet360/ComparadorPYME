# ODD Feature: Limpieza de Repositorio y Actualización Documental

Rama: `chore/repo-cleanup-and-docs` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run test:unit && npm run test:integration`

## Specs

- S1 (Higiene Git, Destracking `Ejemplos/` y Poda de Obsoletos): Podar las 16 ramas locales y 5 remotas ya mergeadas en `main`/`origin/main`; destrackear `Ejemplos/` manteniendo los archivos locales; eliminar duplicados y obsoletos (`.opencode/skills/modificacion-local-backup/`, `.opencode/package-lock.json`, `.gcloudignore`, `docs/BRANCHES.md`, `docs/ROLLBACK.md`, `docs/manual/Manual_de_Usuario_CSA_frozen.html`).
- S2 (Actualización de `README.md` y Documentación Core): Alinear `README.md` con la versión actual (10 ramos en `data/domains/*`, `/api/v1/*` + `/api/v1/openapi.json`, cola asíncrona PDF SSE/polling/cancel, DaaS + webhooks HMAC, portafolio/renovaciones multi-tenant, matriz virtualizada, modelos Gemini de `env.ts` y scripts vigentes); reparar enlaces y contradicciones en `CONTRIBUTING.md`, `docs/BRANCH_PROTECTION_SETUP.md`, `docs/DEPLOY.md`, `ARCHITECTURE.md`, `docs/STAGING_GUIDE.md`, `docs/CLAUSE_LIBRARY_WORKFLOW.md` y actualizar `docs/database-description.md` hasta la migración `037`.
- S3 (Verificación de Integridad y Tests): Confirmar `npm run format:check` con 0 advertencias, links locales válidos y `test:unit` + `test:integration` sin regresiones.

## Tasks

- [x] T1 | S1 | route: inline | status: completed | commit: eed02ef — Poda de ramas locales/remotas mergeadas, `git rm -r --cached Ejemplos/` y eliminación de duplicados/obsoletos (Risk: item 5 entrega/git)
- [x] T2 | S2 | route: inline | status: completed | commit: e4e90ac — Reescritura de `README.md` y actualización de `CONTRIBUTING.md`, `ARCHITECTURE.md` y `docs/*` (Passive)
- [x] T3 | S3 | route: inline | status: completed — Formato Prettier, validación de links/tests y cierre ODD

## Log

- L1 (2026-11-23): Usuario autorizó "Si, ademas quiero destrackear ejemplos y quiero podar las ramas mergeadas" -> creada rama `chore/repo-cleanup-and-docs`.
- L2 (2026-11-23): T1 (`eed02ef`), T2 (`e4e90ac`) y T3 completados; `format:check`, `p2InfraDocsT3.test.ts`, `apiVersioningOpenApiT1.test.ts`, `test:unit` y `test:integration` en verde. Pendiente autorización del usuario para mergear `chore/repo-cleanup-and-docs` a `main` y pushear a `origin`.
