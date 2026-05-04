## Context

El proyecto Comparador CSA actualmente cuenta con múltiples configuraciones de despliegue que generan inconsistencias:

- **Dockerfile raíz**: Construye frontend + backend, pero espera archivos pre-compilados
- **server/Dockerfile**: Solo construye backend, ignora frontend
- **docker-compose.yml**: Usa server/Dockerfile, solo backend
- **railway.json**: Usa Nixpacks, solo backend, ignora frontend
- **deploy.ps1**: Cloud Run, usa Dockerfile raíz con variables hardcodeadas

Además, `dist/` y `server/dist/` están versionados en Git, lo cual es un anti-patrón que causa conflictos y desincronización.

## Goals / Non-Goals

**Goals:**
- Unificar el despliegue en un solo contenedor Docker que sirva frontend y backend
- Eliminar código compilado del repositorio Git (build en Railway automáticamente)
- Simplificar el proceso de deploy a un solo `git push`
- Mantener las mismas variables de entorno y APIs existentes
- Reducir el número de archivos de configuración de despliegue

**Non-Goals:**
- Separar frontend y backend en diferentes contenedores/servicios
- Cambiar la arquitectura de la aplicación (monolito Express sirviendo SPA sigue siendo válido)
- Modificar endpoints de API o comportamiento funcional
- Migrar a otro proveedor de cloud (se mantiene Railway)
- Implementar CI/CD adicional más allá del auto-deploy de Railway

## Decisions

### 1. Usar Dockerfile multi-stage en Railway

**Decisión**: Reemplazar Nixpacks por Docker builder en Railway.

**Rationale**: Nixpacks intenta "adivinar" la configuración y solo construye el backend. Con Dockerfile tenemos control total del build, podemos hacer multi-stage (frontend + backend), y es reproducible localmente.

**Alternativas consideradas**:
- Mantener Nixpacks con buildCommand personalizado: Fragil, difícil de debuggear
- Usar Docker Compose en Railway: No soportado nativamente, overkill para un solo servicio
- Separar frontend y backend en dos servicios Railway: Complejidad innecesaria para esta escala

### 2. Monolito: Express sirve frontend estático

**Decisión**: Mantener la arquitectura actual donde Express sirve los archivos estáticos de `dist/`.

**Rationale**: Es el patrón más simple para esta escala. No necesitamos CDN ni frontend separado. Un solo puerto, un solo dominio, CORS simplificado.

**Alternativas consideradas**:
- Frontend en Vercel/Netlify + Railway backend: Añade complejidad de CORS y dos puntos de despliegue
- CDN para assets: Overkill para el volumen de tráfico actual

### 3. Build en Railway, no localmente

**Decisión**: Eliminar `dist/` y `server/dist/` de Git y hacer el build dentro del contenedor.

**Rationale**: Una sola fuente de verdad (código fuente). El build se hace en la infraestructura de Railway donde está optimizado. No más "olvidé compilar antes del commit".

**Riesgo**: Primer build más lento (descarga de dependencias)
**Mitigación**: Docker layer caching en Railway; capas de `npm ci` se cachean si `package.json` no cambia

### 4. Separar dependencias: package.json raíz (frontend) vs server/package.json (backend)

**Decisión**: Limpiar el `package.json` raíz para tener solo dependencias del frontend y scripts de build.

**Rationale**: Claridad. El Dockerfile multi-stage instala dependencias independientemente en cada stage. El `package.json` raíz actual tiene mezcladas dependencias de backend (express, cors, etc.) como principales, lo cual es incorrecto.

### 5. Variables de entorno: Railway inyecta todo

**Decisión**: No hardcodear variables en Dockerfile. Usar las mismas variables configuradas en Railway Dashboard.

**Rationale**: Railway inyecta variables automáticamente en build time y runtime. `GEMINI_API_KEY` se usa en backend (runtime) y `VITE_GEMINI_API_KEY` en frontend (build time).

**Nota importante**: Vite requiere variables con prefijo `VITE_` para exponerlas al cliente. Mantener ambas variables (`GEMINI_API_KEY` para backend, `VITE_GEMINI_API_KEY` para frontend build) o usar la misma valor para ambas.

## Risks / Trade-offs

**[Riesgo] Build más lento en Railway** → **Mitigación**: Multi-stage build cachea capas. Si solo cambia código fuente sin tocar package.json, el stage de `npm ci` usa cache.

**[Riesgo] Variables de entorno no disponibles en build time** → **Mitigación**: Railway inyecta variables automáticamente. Dockerfile usa `ARG` para capturarlas durante build. Verificar en dashboard que todas las variables estén configuradas.

**[Riesgo] Dependencias nativas fallan en Alpine** → **Mitigación**: Instalar `python3 make g++` en stages de build. Stage de producción solo copia binarios compilados, no necesita build tools.

**[Riesgo] `dist/` ignorado accidentalmente en desarrollo** → **Mitigación**: `.gitignore` solo afecta a Git, no al filesystem local. En desarrollo se sigue generando `dist/` normalmente con `npm run build`.

**[Riesgo] Primer deploy falla por falta de archivos compilados** → **Mitigación**: Dockerfile construye todo dentro del contenedor. No depende de archivos pre-existentes.

**[Trade-off] Imagen Docker más grande** → Multi-stage build mantiene la imagen final pequeña (solo Node.js + archivos compilados + dependencias de producción). Stage de build se descarta.

## Migration Plan

### Fase 1: Preparación (local)
1. Backup de variables de entorno actuales
2. Crear rama `feature/unified-docker-deployment`
3. Aplicar cambios de archivos (Dockerfile, railway.json, .gitignore, etc.)

### Fase 2: Limpieza del repo
4. Quitar `dist/` y `server/dist/` del tracking de Git: `git rm -r --cached dist/ server/dist/`
5. Commit de todos los cambios

### Fase 3: Deploy
6. Push a GitHub
7. Railway detecta el cambio y construye con Dockerfile
8. Monitorear logs del primer build (puede tardar 3-5 minutos)

### Fase 4: Verificación
9. Verificar que `/health` responde
10. Verificar que el frontend carga correctamente
11. Verificar que las APIs funcionan (`/api/analyze`, `/api/rag/clauses`, etc.)
12. Verificar que variables de entorno se inyectaron correctamente

### Rollback
- Si el deploy falla: Revertir el commit en GitHub, Railway hará deploy automático del estado anterior
- Alternativa: En Railway dashboard, hacer rollback a deployment anterior

## Open Questions

1. **¿El Dockerfile debe incluir un healthcheck?** → Sí, recomendado para que Railway sepa si el contenedor está saludable.
2. **¿Necesitamos un script de deploy local para pruebas?** → Opcional. `docker build -t comparador-csa .` y `docker run -p 8080:8080 comparador-csa` sirven para validar.
3. **¿Deberíamos agregar `.dockerignore` para evitar copiar `.env`?** → Sí, crítico para seguridad.
