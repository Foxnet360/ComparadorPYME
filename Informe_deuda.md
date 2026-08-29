# Informe de Deuda Técnica — comparadorpyme (comparador-csa)

- **Fecha de auditoría:** 2026-08-28
- **Alcance:** frontend (React + Vite + Tailwind), backend (Express + TypeScript en `server/`), capa de datos (Supabase), tests, configuración y DevOps.
- **Health score general:** **45 / 100** — el proyecto **no está en un estado sostenible**.

---

## 1. Resumen ejecutivo

El proyecto entrega funcionalidad real en producción, pero arrastra:

1. **Colapso de seguridad y control de acceso** — secretos de producción commiteados (service-role key de Supabase, API key de Gemini), un backdoor de admin hardcodeado, y la mayoría de las rutas de lectura/escritura del backend sin middleware de autenticación. El backend usa la service-role key en todas las operaciones, saltando RLS por completo.
2. **Componentes dios y deriva arquitectónica** — `App.tsx` (~660 LOC) concentra routing + auth + estado del analizador + header + UI de carga; `ComparisonReport.tsx` (~872 LOC) mezcla renderizado, tabs, correcciones, exportación PDF y gráficos. Los contextos `AuthContext` y `UIContext` existen pero nunca se montan.
3. **Caos de dependencias y versiones** — React 19 con tipos de React 18, dos SDKs de Google instalados, dos clientes Redis, `dotenv@^17.2.3` (major inexistente), `@types/node@25`, `lucide-react@1.14.0` desactualizado.

---

## 2. Métricas rápidas

| Métrica | Valor |
|---|---|
| Tipo de repo | SPA Vite React + API Express, `package.json` único |
| Dependencias directas | ~38 runtime + ~37 dev (~75 total) |
| Archivos fuente frontend | ~70 `.ts/.tsx` (`components/`, `services/`, `hooks/`, `utils/`, `contexts/`, `src/`) |
| Archivos fuente backend | ~100+ `.ts` en `server/src/` |
| Archivos de test | ~108 (`.test.ts` / `.test.tsx`) |
| Umbrales de cobertura | líneas 20%, statements 20%, funciones 20%, branches 15% |
| Componentes más grandes | `App.tsx` ~660 LOC, `ComparisonReport.tsx` ~872 LOC |
| LOC (aprox.) | 50 000+ (estimado por conteo de archivos; no medido con `cloc`) |
| Migraciones | `server/supabase/migrations/`, `server/supabase-migration-complete.sql`, `server/src/migrations/` |

---

## 3. Registro de deuda

### CRÍTICA

| Severidad | Categoría | Ubicación | Problema | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|---|
| CRÍTICA | Seguridad | `.env`, `.env.local`, `.env.test.local`, `.env.railway`, `server/.env` (trackeados pese a `.gitignore`); `server/src/scripts/runMigrations.js:9-11`; `server/src/scripts/setupSupabase.ts:11-12`; `services/authService.ts:4-6` | Secretos de producción commiteados: service-role key de Supabase, anon key y API key de Gemini. `runMigrations.js` hardcodea la service-role key. | Compromiso total de base de datos / storage; robo de cuota; hay que rotar secretos aunque se borren porque el historial es público. | 1) Rotar **todas** las claves ya. 2) Mover config a secretos de Railway/CI. 3) Purgar historial con `git-filter-repo` o BFG. 4) Verificar `.env*` en `.gitignore` y untracked. | S limpieza / M rotación |
| CRÍTICA | Seguridad | `services/storageService.ts:51-63` | Backdoor hardcodeado `admin@seguros.com` / `admin123` que setea `role: 'ADMIN'`. | Cualquiera puede autenticarse como admin; bypasea Supabase Auth. | Eliminar el branch; forzar todos los logins por Supabase Auth. Agregar RBAC en backend. | XS |
| CRÍTICA | Seguridad | `server/src/index.ts:183-217` — `/api/documents`, `/api/search`, `/api/audit`, `/api/chat`, `/api/analysis/*` (salvo export), `/api/comparison` | La mayoría de las rutas de lectura/escritura **no tienen** middleware de auth. `optionalAuthMiddleware` solo está en `/api/analyze`, `/api/history`, `/api/comparison`, `/api/clients`. | Usuarios anónimos pueden indexar documentos, correr análisis, buscar en RAG, crear chats y leer historial. | Aplicar `authMiddleware` a todas las rutas no públicas; propagar ownership del usuario a las operaciones de DB. | M |
| CRÍTICA | Seguridad | `server/src/config/database.ts:15-30`; `server/src/index.ts:49`; `server/src/routes/clientRoutes.ts:25` | El backend usa `SUPABASE_SERVICE_ROLE_KEY` para cada llamada a DB, saltando RLS y políticas de ownership por fila. | Cualquier bug o bypass de auth da acceso total a la DB; el aislamiento multi-tenant es solo convención. | Usar el cliente anon en rutas client-facing o forzar checks `user_id` server-side en cada escritura. | L |
| CRÍTICA | Seguridad | `components/InlineNoteEditor.tsx:84-87` | Usa `dangerouslySetInnerHTML` para preview de markdown tras `marked` + `DOMPurify`. | XSS posible si `marked` o `DOMPurify` se bypasean. | Reemplazar con un renderer markdown→React (p. ej. `react-markdown`, ya instalado). | S |

### ALTA

| Severidad | Categoría | Ubicación | Problema | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|---|
| ALTA | Arquitectura | `App.tsx:1-660` | Componente dios: routing, estado de auth, estado del analizador, manejo de archivos, cambio de vistas, header, UI de carga, todo en un archivo. | Imposible de unit-testear; cada cambio arriesga regresiones; viola SRP. | Introducir React Router (o routing file-based) y separar en `pages/` + hooks por feature. | L |
| ALTA | Arquitectura | `components/ComparisonReport.tsx:1-872` | Componente dios: renderizado de reporte, tabs, correcciones, export PDF, gráficos, tabs de análisis avanzado. | Ídem anterior; además fuerza un chunk de bundle grande. | Descomponer en page shell + `ReportTabs`, `QuoteCards`, `CoverageMatrix`, `ExportBar`, etc. | L |
| ALTA | Estado | `App.tsx` + `contexts/AnalysisContext.tsx` + `contexts/AuthContext.tsx` + `contexts/UIContext.tsx` | `AuthContext` y `UIContext` se exportan pero **nunca** se montan en `App.tsx` ni `index.tsx`; `App.tsx` duplica su estado. | Providers muertos; estado duplicado; fuente de datos stale y bugs. | Montar los providers y consumirlos, o eliminarlos. Usar `AnalysisContext` de forma consistente. | S |
| ALTA | Seguridad | `services/storageService.ts:36-188`; `services/db.ts:1-137` | El frontend guarda usuarios y auth casi en texto plano en IndexedDB/localStorage. | Fuga de credenciales, falsificación local, sin invalidación de sesión. | Eliminar auth storage local; depender de sesiones de Supabase Auth e identidad server-side. | M |
| ALTA | Type Safety | `package.json:67-89` | `react@^19.2.5` con `@types/react@^18.2.0`, `react-dom@19` con `@types/react-dom@18.3.7`, `react-is@18.3.1`. | Las declaraciones de tipos no matchean el runtime; errores de build/IDE y tipos de hooks faltantes. | Alinear React y paquetes de tipos a 19.x (o bajar React a 18.3). | XS |
| ALTA | Dependencias | `package.json:39-40`, `53`, `65`, `68`, `71` | Instalados `@google/genai` y el legacy `@google/generative-ai`; `ioredis` y `redis` a la vez. | Bloat, APIs en conflicto, imports confusos. | Eliminar `@google/generative-ai` y estandarizar un solo cliente Redis (el que espera `rate-limit-redis`). | M |
| ALTA | Dependencias | `package.json:38`, `47`, `57`, `63`, `65`, `88` | `@google-cloud/storage@5.18.3` (muy viejo), `lucide-react@1.14.0`, `pdfjs-dist@3.11.174`, `dotenv@^17.2.3` (major no publicado), `@types/node@25` (odd/canary). | Vulnerabilidades, installs rotos, APIs stale. | Auditar con `npm audit`, subir a majors actuales, fijar `dotenv` a `^16.4.7`. | M |
| ALTA | Type Safety | `App.tsx:389-390`, `components/ProfileScreen.tsx:172-181`, `components/ClientSelector.tsx:526`, `server/src/controllers/analysisValidationController.ts:325-372`, `server/src/services/groundingAuditor.ts:21-48`, entre otros | 44+ casts `as any` y muchos `any` en caminos de lógica. | Oculta bugs; anula el valor de TypeScript. | Reemplazar con tipos reales; activar `noImplicitAny`/`strict` en tsconfig frontend y elevar `no-explicit-any` a error. | M |
| ALTA | Observabilidad | `server/src/controllers/analysisController.ts:194-233`, `290-306`, `server/src/controllers/documentController.ts:115-147`, `251`, y muchos más; `utils/logger.ts` | `console.log/warn/error` dispersos con prefijos emoji ad-hoc. | Logs inconsistentes; ruido en producción; difícil correlacionar. | Enrutar todo por `pino`/`structuredLogger`; eliminar logs de debug antes de merge. | M |
| ALTA | Manejo de errores | `server/src/controllers/analysisController.ts:286-326` (traga error de save), `server/src/routes/clientRoutes.ts:87-89` (ignora checkError), `server/src/controllers/documentController.ts:227-234` (devuelve 500 directo, sin `next(error)`) | Errores logueados pero no propagados al error handler central; algunos se tragan. | Respuestas de API inconsistentes; fallos ocultos. | Usar `next(error)` en todas partes y dejar que `errorHandler.ts` arme las respuestas. | M |
| ALTA | Testing | `vitest.config.ts:92-96` | Umbrales de cobertura en 20% líneas / 15% branches. | Confianza falsa; gran superficie sin testear. | Subir a al menos 70% líneas / 60% branches para código nuevo; gate en CI. | M |
| ALTA | Performance | `services/apiClient.ts:15-61`; `services/geminiService.ts:34-56` | Sin timeout, abort controller ni retry en el cliente API del frontend. | El usuario puede esperar indefinidamente en `/analyze`; no hay forma de cancelar. | Agregar `AbortController` + timeout configurable; exponer cancelación en la UI. | S |
| ALTA | DevOps | `Dockerfile:15-27` | Imagen single-stage copia todo el repo (incluye `.env`) y mantiene tooling de build en la imagen final. | Imagen grande, fuga de secretos, deploys más lentos. | Agregar `.dockerignore`, usar multi-stage build, nunca copiar `.env*`. | M |

### MEDIA

| Severidad | Categoría | Ubicación | Problema | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|---|
| MEDIA | Estado | `App.tsx:47-57` vs `contexts/AnalysisContext.tsx:94-115` | El estado del analizador vive tanto en estado local de `App.tsx` como en el reducer de `AnalysisContext`. | Confusión sobre la fuente de verdad; doble actualización. | Consolidar en `AnalysisContext` o en una state machine router-aware. | M |
| MEDIA | Arquitectura | `server/src/config/featureFlags.ts`, `server/src/services/unifiedComparison/comparisonEngineAdapter.ts`, `server/src/services/gemini.ts` | Múltiples pipelines paralelos (V1/V2, legacy/unified, multimodal on/off) seleccionados por env/feature flags. | Mucho branching, lógica de prompt/extracción duplicada, difícil razonar corrección. | Sunset de V1 con plan de deprecación; eliminar caminos legacy una vez estable. | L |
| MEDIA | Mantenibilidad | `App.tsx:48`, `server/src/controllers/analysisController.ts:157-169`, `types.ts:371` | Literal de dominio `'pyme' \| 'autos'` en App, mientras el backend acepta 8 dominios. | Drift de tipos; magic strings. | Definir un único enum `InsuranceDomain` compartido entre frontend y backend. | XS |
| MEDIA | Manejo de errores | `server/src/index.ts:265-277` | Bloque de logging de startup duplicado verbatim. | Ruido; mantenibilidad. | Eliminar el bloque duplicado. | XS |
| MEDIA | Seguridad | `server/src/middleware/rateLimiter.ts` | Hay rate limiters pero no están cableados globalmente; `/api/compare-extraction` y rutas de documentos carecen de límite. | Abuso / exposición de costos. | Aplicar `globalRateLimiter` a todas las rutas; `analyzeRateLimiter` en rutas de análisis. | S |
| MEDIA | Performance | `components/*.tsx` (muchos), p. ej. `components/ComparisonReport.tsx:3-13` | Barrel imports completos de `lucide-react` y `recharts`. | Bundles más grandes pese a manual chunks. | Importar archivos de íconos individuales; tree-shake de `recharts`. | M |
| MEDIA | DevOps | `server/src/middleware/auth.ts:34`, `server/src/index.ts:79-95` | JWT secret opcional; orígenes CORS parseados de un JSON string con fallback permisivo. | En producción, falta de `SUPABASE_JWT_SECRET` acepta tokens sin verificar silenciosamente; fallback CORS permisivo. | Hacer el JWT secret obligatorio en producción; fallar cerrado. | S |
| MEDIA | Base de datos | `server/supabase/migrations/001_initial_schema.sql:426-478` | RLS habilitado pero la mayoría de tablas de referencia son world-readable y no hay políticas de escritura/borrado para `documents`, `chunks`, `clause_chunks`, etc. | Si el backend alguna vez usa anon key, las escrituras fallan o quedan sin control. | Definir políticas RLS de escritura explícitas o documentar el modelo de bypass por service-role. | M |

### BAJA

| Severidad | Categoría | Ubicación | Problema | Impacto | Recomendación | Esfuerzo |
|---|---|---|---|---|---|---|
| BAJA | Mantenibilidad | `server/src/services/unifiedComparison/comparisonEngineAdapter.ts:205`, `unifiedComparisonEngine.ts:650`, `alertingService.ts:185` | `TODO` pelados sin tickets. | Trabajo / contexto perdido. | Convertir en issues trackeados o eliminarlos. | XS |
| BAJA | Testing | `server/src/services/__tests__/accuracy.test.ts:201`, `analysis.e2e.test.ts:212-254`, `performance.test.ts:86`, `integration.test.ts:36` | Tests skipeados condicionalmente con `describe.skip`/`it.skip` según env keys. | El comportamiento de CI depende de secretos; cobertura flaky. | Mockear servicios externos o mover tests de API real a un job nightly de integración. | S |
| BAJA | Mantenibilidad | `index.tsx` en la raíz del repo; no hay `src/main.tsx` | Ubicación de entry no estándar para Vite. | Fricción de onboarding. | Mover el entry a `src/main.tsx` y actualizar `index.html`. | XS |
| BAJA | Mantenibilidad | `components/ChatBot.tsx`, `hooks/useAdvancedAnalysis.ts`, `hooks/useOptimisticCorrection.ts` | Bloques `catch (error)` genéricos solo con strings user-facing. | Fallos silenciosos; sin telemetría. | Loguear errores estructurados y exponer request IDs. | S |

---

## 4. Top 5 acciones priorizadas

1. **Rotar los secretos commiteados y purgar el historial de git** — inmediato; todo lo demás es irrelevante mientras `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` estén en el repo.
2. **Eliminar el backdoor de admin** en `services/storageService.ts:51-63` — cero valor, riesgo máximo.
3. **Aplicar autenticación a las rutas de documentos/búsqueda/análisis/chat** y forzar ownership server-side — cierra la mayor brecha de autorización.
4. **Centralizar manejo de errores y logging** — dejar de tragar errores y reemplazar `console.log` por el logger estructurado existente.
5. **Corregir los desajustes de dependencias/tipos** — alinear React 19 con `@types/react` 19, eliminar SDKs duplicados y arreglar la versión inválida de `dotenv`.

---

## 5. Observaciones / seguimiento

- **Verificación en runtime pendiente**: no se pudieron correr build, tests ni `npm audit` en el entorno de auditoría. Confirmar los hallazgos de dependencias con `npm ci` y `npm audit`.
- **Tamaño de bundle**: hay manual chunks en `vite.config.ts`, pero los barrel imports de `lucide-react` y `recharts` probablemente sigan generando un primer chunk grande; se recomienda análisis de bundle.
- **RPC `exec_sql` de Supabase**: `setupSupabase.ts` y `runMigrations.js` dependen de un RPC custom `exec_sql`. No se verificó su existencia ni modelo de permisos; si es público, es un riesgo crítico de SQL injection/admin.
- **Estado de tracking de `.env`**: estos archivos aparecen en el working tree estando listados en `.gitignore`. Probablemente se commitearon antes de agregar las reglas; verificar con `git ls-files | grep '\.env'` y purgar del historial.
- **Calidad de tests**: la cantidad es alta, pero los umbrales son bajos y muchos tests de integración se skipean sin claves reales. Separar unit tests rápidos de integration tests lentos con API real en CI.
- **Realidad del RBAC**: la UI muestra roles "super_admin / ally_admin / ally_technical", pero el backend no parece forzar checks de rol más allá de ownership por user ID. Se necesita una revisión de diseño RBAC completa.
