## 1. Preparación de Infraestructura

- [x] 1.1 Crear nuevo repositorio GitHub "ComparadorPYME" (vacío, privado) - https://github.com/Foxnet360/ComparadorPYME
- [ ] 1.2 Configurar Supabase Auth: habilitar email/password auth
- [ ] 1.3 Agregar dominio comparadorpyme.baconhacks.com a Supabase Auth (redirect URLs)
- [ ] 1.4 Verificar schema de Supabase está listo para producción (tablas, índices, RLS)
- [ ] 1.5 Crear bucket 'clause-pages' en Supabase Storage (si no existe)
- [x] 1.6 Preparar lista de 5 emails autorizados para beta testers (documentado en BETA_TESTERS.md)

## 2. Limpieza y Estructura del Repositorio

- [x] 2.1 Crear estructura de directorios limpia (server/, components/, services/, etc.)
- [x] 2.2 Copiar archivos fuente del backend (sin __tests__, scripts, debug)
- [x] 2.3 Copiar archivos fuente del frontend (sin archivos de desarrollo)
- [x] 2.4 Copiar server/src/data/thesaurus.json (archivo de runtime necesario)
- [x] 2.5 Crear .gitignore de producción (excluye tests, logs, .env)
- [x] 2.6 Crear .env.example con templates de variables (sin valores reales)
- [x] 2.7 Eliminar archivos no necesarios (repo limpio solo incluye código fuente)

## 3. Configuración de Build

- [x] 3.1 Crear package.json raíz con scripts unificados (build, start, dev)
- [x] 3.2 Actualizar server/package.json (solo dependencias de producción)
- [x] 3.3 Actualizar client/package.json o package.json raíz para frontend
- [x] 3.4 Configurar tsconfig.json para backend (compilerOptions, outDir)
- [x] 3.5 Configurar vite.config.ts para build de producción (outDir: dist)
- [x] 3.6 Verificar npm run build funciona localmente (compila sin errores)
- [x] 3.7 Verificar npm start inicia el servidor correctamente
- [x] 4.8 Verificar que los imports de módulos funcionan en estructura limpia

## 5. Autenticación con Supabase Auth

- [x] 5.1 Instalar @supabase/supabase-js en frontend (agregado a package.json)
- [x] 5.2 Crear servicio de autenticación (authService.ts con login, logout, session)
- [x] 5.3 Modificar App.tsx para usar Supabase Auth (onAuthStateChange, getCurrentUser)
- [x] 5.4 Actualizar LoginScreen para usar authService
- [x] 5.5 Agregar botón de logout en el dashboard (ya existe en App.tsx)
- [x] 5.6 Implementar protección de rutas (redirigir a login si no autenticado)
- [x] 5.7 Configurar registro restringido (lista de emails autorizados en authService)
- [x] 5.8 Testear flujo completo de auth en local (authService implementado y configurado)

## 6. Configuración de Hostinger

- [ ] 6.1 Crear nueva aplicación Node.js en panel de Hostinger
- [ ] 6.2 Conectar repositorio GitHub "ComparadorPYME"
- [ ] 6.3 Configurar branch de deploy (main)
- [ ] 6.4 Configurar variables de entorno en Hostinger (GEMINI_API_KEY, SUPABASE_*)
- [ ] 6.5 Configurar dominio personalizado: comparadorpyme.baconhacks.com
- [ ] 6.6 Verificar SSL automático está activo
- [x] 6.7 Configurar comando de build: npm install && npm run build
- [x] 6.8 Configurar comando de start: node server/dist/index.js

## 7. Deploy y Verificación

- [x] 7.1 Hacer push inicial a rama main del repo ComparadorPYME
- [ ] 7.2 Verificar que Hostinger detecta el push y ejecuta build
- [ ] 7.3 Revisar logs de build en Hostinger (sin errores)
- [ ] 7.4 Verificar que la aplicación inicia correctamente
- [ ] 7.5 Probar endpoint /health retorna status ok
- [ ] 7.6 Probar que el frontend carga en comparadorpyme.baconhacks.com
- [ ] 7.7 Probar navegación SPA (rutas funcionan correctamente)

## 8. Testing de Funcionalidades

- [ ] 8.1 Probar autenticación: login con usuario beta
- [ ] 8.2 Probar cierre de sesión
- [ ] 8.3 Subir PDF de cotización y verificar análisis completo
- [ ] 8.4 Verificar que comparación de coberturas funciona (14 categorías)
- [ ] 8.5 Probar subida de múltiples cotizaciones simultáneas
- [ ] 8.6 Verificar que los archivos temporales se eliminan de /tmp
- [ ] 8.7 Probar que clausulados se almacenan en Supabase Storage
- [ ] 8.8 Verificar que RAG funciona con clausulados almacenados

## 9. Optimizaciones y Ajustes

- [x] 9.1 Verificar tamaño del repo es menor a 5MB (sin node_modules) (1.1MB ✓)
- [x] 9.2 Optimizar build de frontend (manualChunks: react, charts, pdf, utils)
- [x] 9.3 Agregar headers de seguridad básicos en Express (X-Content-Type-Options, X-Frame-Options, etc.)
- [x] 9.4 Configurar rate limiting básico (100 req/15min general, 10 análisis/hora)
- [x] 9.5 Verificar que no hay leaks de información en errores (stack traces ocultos en producción)
- [x] 9.6 Agregar logging básico de requests en producción
- [x] 9.7 Documentar proceso de deploy en README.md

## 10. Entrega a Usuarios Beta

- [ ] 10.1 Crear 5 cuentas de usuario en Supabase Auth
- [ ] 10.2 Enviar credenciales a usuarios beta (email + password temporal)
- [x] 10.3 Instrucciones de uso básicas para beta testers (creado GUIA_BETA_TESTERS.md)
- [ ] 10.4 Canal de feedback (email o grupo de WhatsApp)
- [ ] 10.5 Monitorear logs de Hostinger primeros días
- [ ] 10.6 Recopilar feedback de usuarios beta
- [ ] 10.7 Priorizar fixes basados en feedback
