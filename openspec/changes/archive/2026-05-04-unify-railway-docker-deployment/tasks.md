## 1. Configuración Git y Limpieza

- [ ] 1.1 Actualizar `.gitignore` para excluir `dist/` y `server/dist/`
- [ ] 1.2 Quitar `dist/` del tracking de Git: `git rm -r --cached dist/`
- [ ] 1.3 Quitar `server/dist/` del tracking de Git: `git rm -r --cached server/dist/`
- [ ] 1.4 Crear `.dockerignore` en raíz del proyecto
- [ ] 1.5 Verificar que `git status` no muestra archivos compilados como modificados

## 2. Actualización de Archivos de Configuración

- [ ] 2.1 Actualizar `package.json` raíz: agregar script `"build": "vite build"`, limpiar dependencias de backend
- [ ] 2.2 Verificar que `index.js` en raíz apunte correctamente a `server/dist/index.js`
- [ ] 2.3 Actualizar `vite.config.ts` para manejar rutas relativas en producción y proxy solo en desarrollo
- [ ] 2.4 Actualizar `railway.json` para usar builder `DOCKER`
- [ ] 2.5 Crear nuevo `Dockerfile` multi-stage en raíz (Stage 1: frontend, Stage 2: backend, Stage 3: producción)

## 3. Eliminación de Archivos Obsoletos

- [ ] 3.1 Eliminar `server/Dockerfile`
- [ ] 3.2 Eliminar `docker-compose.yml`
- [ ] 3.3 Eliminar `deploy.ps1`
- [ ] 3.4 Verificar que no queden archivos de despliegue duplicados

## 4. Documentación

- [ ] 4.1 Crear `DEPLOY.md` con: variables de entorno requeridas, proceso de deploy, troubleshooting, rollback
- [ ] 4.2 Actualizar `README.md` sección de despliegue para reflejar proceso actual (git push → Railway auto-deploy)
- [ ] 4.3 Verificar que `README.md` no mencione archivos de despliegue eliminados (docker-compose, deploy.ps1)

## 5. Commit y Pruebas Locales

- [ ] 5.1 Hacer commit de todos los cambios con mensaje descriptivo
- [ ] 5.2 Probar build Docker localmente: `docker build -t comparador-csa .`
- [ ] 5.3 Probar contenedor localmente: `docker run -p 8080:8080 comparador-csa`
- [ ] 5.4 Verificar que `/health` responde en el contenedor local
- [ ] 5.5 Verificar que el frontend carga en `http://localhost:8080`

## 6. Deploy en Railway

- [ ] 6.1 Push a GitHub (rama principal)
- [ ] 6.2 Verificar que Railway detecta el cambio e inicia build con Docker
- [ ] 6.3 Monitorear logs del build (esperar 3-5 minutos para primer build)
- [ ] 6.4 Verificar que el deploy se completa sin errores
- [ ] 6.5 Verificar que `/health` responde en la URL de producción
- [ ] 6.6 Verificar que el frontend carga correctamente
- [ ] 6.7 Verificar que las APIs funcionan (`/api/analyze`, `/api/rag/clauses`, etc.)
- [ ] 6.8 Verificar que variables de entorno se inyectaron correctamente (Gemini, Supabase)

## 7. Verificación Post-Deploy

- [ ] 7.1 Probar flujo completo: subir una cotización y verificar análisis
- [ ] 7.2 Verificar que no hay errores 404 en rutas del frontend (SPA routing)
- [ ] 7.3 Confirmar que `dist/` y `server/dist/` ya no están en Git
- [ ] 7.4 Documentar cualquier ajuste necesario en `DEPLOY.md`
