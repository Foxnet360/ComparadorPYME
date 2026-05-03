## Why

El proyecto actual tiene múltiples configuraciones de despliegue desalineadas (Dockerfile raíz, Dockerfile server/, docker-compose.yml, railway.json, deploy.ps1) que producen resultados inconsistentes. Railway utiliza Nixpacks y solo construye el backend, omitiendo el frontend. Además, el código compilado (`dist/` y `server/dist/`) está versionado en Git, generando conflictos y desincronización entre el código fuente y los artefactos construidos.

## What Changes

- **Reescribir Dockerfile raíz** con multi-stage build que construya frontend y backend dentro del contenedor
- **Actualizar railway.json** para usar builder `DOCKER` en lugar de `NIXPACKS`
- **Crear `.dockerignore`** para reducir tamaño de imagen y tiempo de build
- **Limpiar `.gitignore`** para excluir `dist/` y `server/dist/` del versionado
- **Actualizar `package.json` raíz** para agregar script `build` y limpiar dependencias
- **Eliminar código compilado del tracking de Git** (`git rm --cached`)
- **Actualizar `vite.config.ts`** para manejar rutas relativas en producción
- **Documentar proceso de despliegue** en archivo `DEPLOY.md`
- **Eliminar archivos de despliegue obsoletos**: `deploy.ps1`, `server/Dockerfile`, `docker-compose.yml`

## Capabilities

### New Capabilities
- `unified-docker-deployment`: Sistema de despliegue unificado usando Docker multi-stage en Railway

### Modified Capabilities
<!-- Este cambio no modifica requisitos funcionales del sistema, solo la infraestructura de despliegue -->

## Impact

**Archivos afectados:**
- `.gitignore`
- `.dockerignore` (nuevo)
- `Dockerfile` (reescritura completa)
- `railway.json`
- `package.json` (raíz)
- `vite.config.ts`
- `server/Dockerfile` (eliminación)
- `docker-compose.yml` (eliminación)
- `deploy.ps1` (eliminación)
- `index.js` (verificación)
- `DEPLOY.md` (nuevo)

**APIs:** Sin cambios. Los endpoints existentes (`/health`, `/api/*`, `/api/rag/*`) se mantienen idénticos.

**Dependencies:** Sin cambios en dependencias funcionales. Solo reorganización de dependencias entre `package.json` raíz y `server/package.json`.

**Sistemas externos:**
- Railway: Cambio de builder de Nixpacks a Docker
- Variables de entorno: Las mismas variables se mantienen, inyectadas por Railway tanto en build time como runtime

**Variables de entorno críticas:**
- `GEMINI_API_KEY` / `VITE_GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `GROQ_API_KEY`
- `CLAUSE_PAGES_BUCKET`
- `REGION`, `SMMLV_VALUE`, `UVT_VALUE`, `CURRENCY`

**Breaking changes:**
- Después de este cambio, `git push` desencadenará un build Docker completo en Railway en lugar de Nixpacks. El primer deploy puede tardar más (build de dependencias), pero los subsiguientes usarán cache.
- Los desarrolladores locales no necesitarán compilar antes de pushear. El build se hace en Railway automáticamente.
