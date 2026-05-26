## Why

El sistema de Comparador CSA tiene múltiples fallas críticas que impiden su funcionamiento correcto en producción: doble sistema de variables de entorno (raíz y server/) causa inconsistencias, el pipeline de extracción multimodal falla silenciosamente y cae en errores genéricos 500, los feature flags activan funcionalidades que dependen de servicios no configurados (Redis), y el manejo de errores no distingue entre errores recuperables (503 de Gemini) y críticos. Estos problemas se acumulan hasta hacer el sistema inusable para los corredores de seguros que dependen de él.

## What Changes

- **Unificar sistema de variables de entorno**: Consolidar en un solo `.env` en raíz con validación en startup
- **Implementar health checks de dependencias**: Verificar Gemini, Supabase y Redis antes de aceptar tráfico
- **Mejorar manejo de errores en pipeline de extracción**: Mapear códigos de error específicos de Gemini (429, 503, timeout) con mensajes claros para el usuario
- **Agregar graceful degradation**: Si una cotización falla, continuar con las demás en lugar de fallar todo el análisis
- **Estabilizar feature flags**: Desactivar por defecto funcionalidades que requieren servicios opcionales
- **Corregir configuración CORS**: Hacer dinámica la lista de orígenes permitidos
- **Mejorar logging estructurado**: Agregar contexto de request ID y fases del pipeline para debugging

## Capabilities

### New Capabilities
- `env-config-validation`: Validación centralizada de variables de entorno con mensajes claros de error
- `health-check-endpoint`: Endpoint `/health` extendido que verifica todas las dependencias críticas
- `graceful-degradation`: Sistema de fallback cuando servicios externos (Gemini, Redis) no están disponibles
- `structured-error-responses`: Respuestas de error estandarizadas con códigos, mensajes accionables y request IDs

### Modified Capabilities
- `error-handling`: Mejorar manejo de errores para distinguir entre errores recuperables y críticos, agregar mensajes específicos por tipo de error de Gemini
- `multimodal-pdf-extraction`: Agregar graceful degradation cuando V2 falla, mejor manejo de timeouts y reintentos
- `feature-flags`: Cambiar defaults para no activar funcionalidades que requieren servicios opcionales

## Impact

- **Backend**: `server/src/index.ts`, `server/src/config/env.ts`, `server/src/controllers/analysisController.ts`, `server/src/config/featureFlags.ts`, `server/src/services/gemini.ts`
- **Frontend**: `services/apiConfig.ts`, `components/FileUploader.tsx` (mejor manejo de errores)
- **Docker**: `Dockerfile` (verificar que .env se copie correctamente)
- **APIs**: Endpoint `/health` retornará estado de dependencias; respuestas de error tendrán nuevo formato
- **Dependencies**: Ninguna nueva; solo mejor uso de existentes
