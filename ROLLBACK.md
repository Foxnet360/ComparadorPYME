# Plan de Rollback - diagnose-and-fix-critical-issues

## Cambios Realizados

Este cambio incluye las siguientes modificaciones al sistema:

1. **Unificación de variables de entorno**: Carga de `.env` desde raíz con fallback a `server/.env`
2. **Health checks extendidos**: Endpoint `/health` verifica Gemini, Supabase y Redis
3. **Manejo de errores mejorado**: Clases `GeminiError` con mensajes en español
4. **Graceful degradation**: Cotizaciones individuales fallan sin detener todo el análisis
5. **Feature flags defensivos**: `learningEngine` desactivado si no hay Redis
6. **CORS dinámico**: Orígenes configurables via `CORS_ORIGINS`
7. **Request IDs**: Trazabilidad en todas las respuestas de error

## Pasos de Rollback

### Opción 1: Rollback Completo (Recomendado)

Si necesitas revertir TODOS los cambios:

```bash
# 1. Identificar el commit anterior al cambio
git log --oneline

# 2. Revertir el commit del cambio
git revert <commit-hash> --no-edit

# 3. Empujar el revert
git push origin main
```

**Nota:** Railway detectará automáticamente el push y redeployará.

### Opción 2: Rollback Parcial por Feature

Si solo necesitas desactivar ciertas características:

#### Desactivar Health Check Extendido
No se puede desactivar fácilmente sin código. Usar Opción 1.

#### Desactivar Feature Flags Defensivos
```bash
# Forzar activación de learningEngine independientemente de Redis
FEATURE_LEARNING_ENGINE=true
```

#### Desactivar CORS Dinámico
```bash
# No configurar CORS_ORIGINS, usará defaults de localhost
# O configurar manualmente en código
```

#### Desactivar Manejo de Errores Nuevo
No se puede desactivar fácilmente sin código. Usar Opción 1.

### Opción 3: Hotfix Rápido

Si el problema es específico:

1. **Problema con health check**: El endpoint `/health` ahora tarda más. Si causa timeouts en Railway:
   - Aumentar timeout del health check en Railway dashboard
   - O desactivar health checks en Railway (no recomendado)

2. **Problema con CORS**: Si los orígenes no funcionan:
   - Verificar que `CORS_ORIGINS` es un JSON array válido
   - Ejemplo correcto: `["https://example.com", "https://app.example.com"]`

3. **Problema con feature flags**: Si `learningEngine` no se activa:
   - Verificar que `REDIS_URL` está configurado
   - O forzar con `FEATURE_LEARNING_ENGINE=true`

## Verificación Post-Rollback

Después de hacer rollback, verificar:

1. **Variables de entorno**: El servidor carga correctamente desde `server/.env` (fallback aún funciona)
2. **Health check**: `GET /health` debe retornar `{ status: "ok" }` (formato anterior)
3. **Análisis de cotizaciones**: Subir una cotización de prueba
4. **Feature flags**: Verificar `GET /api/features` retorna configuración esperada

## Archivos Modificados

Si necesitas revertir manualmente, estos archivos fueron modificados:

- `.env.example` (nuevo)
- `server/src/index.ts`
- `server/src/config/env.ts`
- `server/src/config/featureFlags.ts`
- `server/src/errors/geminiErrors.ts` (nuevo)
- `server/src/errors/appError.ts` (nuevo)
- `server/src/errors/index.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/services/healthCheckService.ts` (nuevo)
- `server/src/services/gemini.ts`
- `server/src/controllers/analysisController.ts`
- `package.json` (agregó `uuid`)
- `README.md`

## Contacto

Si el rollback no resuelve el problema, contactar al equipo de desarrollo con:
- Commit hash del rollback
- Logs del servidor (Railway dashboard)
- Request ID de cualquier error (si aplica)
