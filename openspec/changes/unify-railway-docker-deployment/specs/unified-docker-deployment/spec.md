## ADDED Requirements

### Requirement: Docker multi-stage build para frontend y backend
El sistema SHALL construir una imagen Docker usando multi-stage build donde:
- Stage 1 compila el frontend React (produciendo `dist/`)
- Stage 2 compila el backend Express (produciendo `server/dist/`)
- Stage 3 (producción) copia solo los artefactos compilados y dependencias necesarias

#### Scenario: Build exitoso en Railway
- **WHEN** Railway recibe un push a la rama principal
- **AND** el builder está configurado como `DOCKER`
- **THEN** Railway construye la imagen usando el Dockerfile raíz
- **AND** el frontend se compila en el stage 1
- **AND** el backend se compila en el stage 2
- **AND** el stage de producción inicia el servidor Express en el puerto configurado

#### Scenario: Imagen final optimizada
- **WHEN** se completa el build multi-stage
- **THEN** la imagen final solo contiene Node.js runtime, archivos compilados y dependencias de producción
- **AND** no incluye herramientas de build (TypeScript compiler, devDependencies)
- **AND** no incluye código fuente TypeScript

### Requirement: Express sirve frontend estático en producción
El sistema SHALL servir el frontend React compilado desde el mismo servidor Express que proporciona la API.

#### Scenario: Ruta raíz carga SPA
- **WHEN** un usuario accede a la ruta raíz `/`
- **AND** `NODE_ENV` es `production`
- **THEN** Express sirve `index.html` desde el directorio `dist/`
- **AND** los assets estáticos (JS, CSS) se sirven desde `dist/assets/`

#### Scenario: Rutas de API funcionan correctamente
- **WHEN** un cliente hace una petición a `/api/*`
- **THEN** Express procesa la petición en los routers correspondientes
- **AND** no intercepta la petición como ruta estática

#### Scenario: SPA routing support
- **WHEN** un usuario accede a una ruta del frontend como `/history` directamente
- **AND** `NODE_ENV` es `production`
- **THEN** Express devuelve `index.html` (SPA fallback)
- **AND** el frontend React Router maneja la ruta

### Requirement: Código compilado excluido de Git
El sistema SHALL excluir directorios de build del versionado Git.

#### Scenario: Git ignore configurado
- **WHEN** un desarrollador hace `git status`
- **THEN** `dist/` no aparece como archivo modificado
- **AND** `server/dist/` no aparece como archivo modificado
- **AND** solo los archivos fuente aparecen en el working tree

#### Scenario: Build automático en Railway
- **WHEN** un desarrollador hace `git push` sin compilar localmente
- **AND** el push no incluye archivos en `dist/` o `server/dist/`
- **THEN** Railway construye automáticamente el frontend y backend durante el deploy
- **AND** la aplicación desplegada funciona correctamente

### Requirement: Variables de entorno inyectadas correctamente
El sistema SHALL leer todas las variables de entorno necesarias desde el entorno de Railway, tanto en build time como en runtime.

#### Scenario: Variables disponibles en backend
- **WHEN** el servidor Express inicia en Railway
- **THEN** puede leer `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.
- **AND** puede conectarse a Supabase
- **AND** puede hacer llamadas a Gemini API

#### Scenario: Variables disponibles en frontend build
- **WHEN** Vite compila el frontend durante el build Docker
- **THEN** `VITE_GEMINI_API_KEY` está disponible
- **AND** se inyecta en el bundle JavaScript compilado

#### Scenario: Variables sensibles no expuestas en imagen
- **WHEN** se inspecciona la imagen Docker
- **THEN** no se encuentran valores hardcodeados de API keys
- **AND** las variables se leen del entorno en runtime

### Requirement: Eliminación de archivos de despliegue obsoletos
El sistema SHALL eliminar configuraciones de despliegue duplicadas u obsoletas.

#### Scenario: Solo un Dockerfile
- **WHEN** se lista la raíz del proyecto
- **THEN** existe exactamente un `Dockerfile` (en raíz)
- **AND** no existe `server/Dockerfile`

#### Scenario: Sin docker-compose
- **WHEN** se verifica la raíz del proyecto
- **THEN** no existe `docker-compose.yml`

#### Scenario: Sin scripts de deploy locales
- **WHEN** se verifica la raíz del proyecto
- **THEN** no existe `deploy.ps1`

### Requirement: Documentación del proceso de despliegue
El sistema SHALL incluir documentación clara del proceso de despliegue.

#### Scenario: README actualizado
- **WHEN** un desarrollador lee `README.md`
- **THEN** encuentra instrucciones claras de cómo desplegar en Railway
- **AND** las instrucciones reflejan el proceso actual (git push → Railway build → deploy)

#### Scenario: DEPLOY.md con detalles técnicos
- **WHEN** un desarrollador lee `DEPLOY.md`
- **THEN** encuentra información sobre variables de entorno requeridas
- **AND** encuentra pasos de troubleshooting comunes
- **AND** encuentra instrucciones para rollback
