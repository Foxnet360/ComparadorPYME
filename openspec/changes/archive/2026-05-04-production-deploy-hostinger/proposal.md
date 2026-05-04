## Why

El proyecto Comparador de Seguros PYME está listo para producción tras completar el sistema de matching semántico de 4 capas (95% precisión) y la matriz unificada de 14 categorías. Sin embargo, actualmente solo corre en localhost y necesita un deploy en Hostinger para que los 5 usuarios beta puedan acceder desde cualquier lugar. Este change establece la infraestructura de producción con un repo limpio, autenticación segura, y optimizaciones de costo para almacenamiento de archivos.

## What Changes

- **Nuevo repo GitHub `ComparadorPYME`** con estructura limpia (sin tests, debug scripts, ni documentación de desarrollo)
- **Unificación de frontend y backend** en una sola app Node.js servida por Express
- **Deploy en Hostinger** con dominio `comparadorpyme.baconhacks.com` vía GitHub integration
- **Autenticación con Supabase Auth** para controlar acceso de los 5 usuarios beta
- **Optimización de almacenamiento**: PDFs de cotizaciones en `/tmp` (efímero), clausulados en Supabase Storage para RAG
- **Configuración de producción**: variables de entorno en Hostinger, build automático, SSL
- **Limpieza de código**: eliminar archivos de desarrollo (tests, scripts debug, mocks, documentación interna)
- **Preparación de base de datos**: asegurar que Supabase tiene el schema correcto para producción

## Capabilities

### New Capabilities
- `hostinger-deployment`: Configuración de deploy en Hostinger Node.js con dominio personalizado, build automático desde GitHub, y variables de entorno
- `supabase-auth`: Autenticación de usuarios usando Supabase Auth con email/password, control de acceso para 5 usuarios beta
- `production-repo-structure`: Estructura de repositorio limpia para producción, excluyendo tests, scripts debug, y documentación de desarrollo
- `production-build-pipeline`: Pipeline de build unificado (frontend Vite + backend TypeScript) compilado por Hostinger

### Modified Capabilities
- `document-upload`: Cambio en el almacenamiento de archivos - PDFs de cotizaciones se almacenan temporalmente en `/tmp` en vez de persistencia local, sin modificar la lógica de extracción
- `clause-storage`: Los clausulados se almacenan en Supabase Storage para persistencia y consulta RAG en producción

## Impact

- **Código**: Nuevo repositorio `ComparadorPYME`, modificación de `server/src/index.ts` para servir frontend estático, nuevo `package.json` unificado
- **APIs**: Mismo contrato API, pero frontend y backend en el mismo dominio (sin CORS)
- **Dependencias**: Eliminación de devDependencies (nodemon, ts-node, vitest) en producción
- **Sistemas**: Hostinger Node.js hosting, Supabase (ya configurado para DB y ahora también para Auth y Storage)
- **Dominio**: `comparadorpyme.baconhacks.com` con SSL automático
- **Proceso de deploy**: Push manual a GitHub → Hostinger compila y deploya automáticamente
