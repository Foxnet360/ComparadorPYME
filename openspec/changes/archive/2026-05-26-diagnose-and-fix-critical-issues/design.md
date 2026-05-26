## Context

El Comparador CSA es una aplicación React + Express que procesa cotizaciones de seguros PYME usando Gemini AI. El sistema actual tiene problemas estructurales:

- **Variables de entorno duplicadas**: Existe `.env` en raíz y `server/.env`, causando inconsistencias entre desarrollo y producción. El backend valida variables en `server/src/config/env.ts` pero el archivo `.env` puede estar en cualquier lado.
- **Pipeline de extracción inestable**: `analysisController.ts` tiene un pipeline V2 (multimodal) con fallback a V1 (texto), pero cuando V2 falla con 503/timeout, el error se propaga como 500 genérico sin contexto.
- **Feature flags agresivos**: `featureFlags.ts` activa `learningEngine: true` por defecto, que requiere Redis. Si Redis no está configurado, falla silenciosamente.
- **Manejo de errores primitivo**: `errorHandler.ts` distingue `AppError` vs genérico, pero no hay categorización por tipo de servicio externo (Gemini 429 vs 503 vs timeout).
- **CORS hardcodeado**: `index.ts` tiene dominios hardcodeados (`compapyme.baconhacks.com`), requiriendo deploy para cambiar.

## Goals / Non-Goals

**Goals:**
- Unificar configuración de entorno en un solo punto con validación estricta al startup
- Health check que reporte estado real de Gemini, Supabase y Redis
- Pipeline de extracción que sobreviva a fallos de cotizaciones individuales
- Errores de Gemini mapeados a mensajes de usuario accionables
- Feature flags que no activen dependencias opcionales sin verificación
- CORS configurable via variable de entorno

**Non-Goals:**
- No migrar de Supabase a otra base de datos
- No reemplazar Gemini por otro LLM
- No implementar retry automático con backoff exponencial complejo (solo mejorar mensajes)
- No agregar nuevas funcionalidades de negocio (ej: nuevos tipos de análisis)
- No cambiar la arquitectura de frontend (React + Vite se mantiene)

## Decisions

### 1. Unificación de Variables de Entorno

**Decisión**: Usar un solo `.env` en raíz del proyecto, cargado por `dotenv` en el entry point del servidor (`server/src/index.ts`).

**Rationale**: 
- El Dockerfile ya copia todo el proyecto a `/app`, por lo que `.env` en raíz estará disponible
- Vite usa `VITE_*` variables automáticamente desde `.env` en build time
- Elimina confusión de "¿cuál .env edito?"

**Implementación**:
- `server/src/index.ts` carga `.env` desde raíz: `dotenv.config({ path: path.resolve(__dirname, '../../.env') })`
- `server/src/config/env.ts` valida todas las variables requeridas y sale con código 1 si falta alguna
- Agregar `.env.example` documentado en raíz

**Alternativas consideradas**:
- Mantener dos archivos: Rechazado porque causa bugs de sincronización
- Usar solo variables de entorno del sistema: Rechazado porque dificulta desarrollo local

### 2. Health Check Extendido

**Decisión**: Extender `GET /health` para probar conectividad real con cada dependencia.

**Rationale**:
- Railway y otros orquestadores usan health checks para routing
- Permite diagnosticar rápidamente si el problema es Gemini, Supabase o Redis

**Implementación**:
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    gemini: { status: 'ok' | 'error'; latency: number };
    supabase: { status: 'ok' | 'error'; latency: number };
    redis?: { status: 'ok' | 'error'; latency: number };
  };
}
```

- Gemini: Ping con `models.list()` o `generateContent` simple
- Supabase: Query `SELECT 1`
- Redis: `PING`

**Alternativas consideradas**:
- Endpoint separado `/health/detailed`: Rechazado porque complica el contrato; mejor extender el existente

### 3. Manejo de Errores por Categoría de Servicio

**Decisión**: Crear `GeminiError` extends `AppError` con categorías específicas que se mapeen a status HTTP y mensajes de usuario.

**Rationale**:
- El usuario necesita saber si debe "esperar y reintentar" (503) vs "contactar soporte" (500)
- Facilita debugging con códigos de error específicos

**Categorías**:
- `RATE_LIMIT` (429): "Límite de requests excedido. Espera 1 minuto y reintenta."
- `SERVICE_UNAVAILABLE` (503): "Gemini temporalmente no disponible. Reintenta en unos momentos."
- `TIMEOUT` (504): "La extracción tomó demasiado tiempo. Intenta con un PDF más pequeño."
- `INVALID_RESPONSE` (502): "Respuesta inesperada de Gemini. Contacta soporte si persiste."
- `UNKNOWN` (500): "Error interno. Contacta soporte."

**Implementación**:
- Nuevo archivo `server/src/errors/geminiErrors.ts`
- Modificar `gemini.ts` para lanzar errores categorizados
- Modificar `analysisController.ts` catch block para manejar cada categoría

### 4. Graceful Degradation en Pipeline

**Decisión**: Si una cotización falla, continuar procesando las demás y reportar la falla en el resultado.

**Rationale**:
- Mejor tener 2 de 3 cotizaciones analizadas que ninguna
- El usuario puede ver qué archivo específico falló

**Implementación**:
- En `analysisController.ts`, el catch por cotización ya crea un objeto de error:
```typescript
parsedQuotes[result.index] = {
  insurerName: filename,
  policyName: 'Error en procesamiento',
  priceAnnual: 0,
  coverages: [],
  specialConditions: [`Error: ${displayError}`],
  parseConfidence: 0
};
```
- Mejorar para incluir `errorCategory` y `isFailed` flag
- Frontend mostrará cotizaciones fallidas con estilo diferenciado (rojo)

### 5. Feature Flags Defensivos

**Decisión**: Cambiar defaults para desactivar funcionalidades que requieren servicios opcionales. Verificar disponibilidad de servicio antes de activar feature.

**Rationale**:
- `learningEngine` requiere Redis; si `REDIS_URL` no está seteado, debe ser `false`
- `hybridSearchV2` funciona sin Redis pero es más lento; mantener `true` porque no falla

**Implementación**:
```typescript
// featureFlags.ts
const redisAvailable = !!process.env.REDIS_URL;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  // ... otras flags
  learningEngine: redisAvailable, // Solo si Redis está configurado
  // ... resto
};
```

### 6. CORS Dinámico

**Decisión**: Leer orígenes permitidos de variable de entorno `CORS_ORIGINS` (JSON array), con defaults seguros.

**Rationale**:
- Evita hardcodear dominios
- Permite múltiples dominios en producción (staging + prod)

**Implementación**:
```typescript
const corsOrigins = process.env.CORS_ORIGINS 
  ? JSON.parse(process.env.CORS_ORIGINS)
  : ['http://localhost:3000', 'http://localhost:8080'];
```

## Risks / Trade-offs

- **[Risk]** Cambiar defaults de feature flags puede romper flujos que asumen `learningEngine: true`
  → **Mitigation**: Agregar log de startup que muestre qué features están activas y por qué

- **[Risk]** Health check que prueba Gemini real consume tokens API
  → **Mitigation**: Usar `models.list()` (gratis) o cachear resultado por 30 segundos

- **[Risk]** Unificar `.env` puede romper workflows de deploy existentes que copian `server/.env`
  → **Mitigation**: Mantener `server/.env` como fallback por 1 release, con deprecation warning

- **[Risk]** Graceful degradation puede ocultar problemas sistémicos (ej: Gemini siempre falla)
  → **Mitigation**: Agregar métrica de "tasa de fallo por cotización" en logs

## Migration Plan

1. **Fase 1 (Preparación)**:
   - Crear `.env.example` en raíz
   - Copiar valores de `server/.env` a raíz `.env`
   - Agregar `CORS_ORIGINS` y verificar que funciona

2. **Fase 2 (Deploy)**:
   - Deploy con nuevos defaults de feature flags
   - Verificar logs de startup muestran features correctas
   - Probar `/health` endpoint

3. **Fase 3 (Validación)**:
   - Subir 3 cotizaciones, forzar fallo en 1 (desconectar internet momentáneamente)
   - Verificar que las otras 2 se procesan correctamente
   - Verificar que errores muestran mensajes claros

4. **Rollback**:
   - Revertir commit
   - Restaurar `server/.env` si se eliminó
   - Feature flags se pueden anular vía `FEATURE_FLAGS` env var

## Open Questions

1. ¿Deberíamos agregar un endpoint `/api/debug/env` que muestre variables cargadas (sin secrets) para facilitar debugging?
2. ¿Cuál es el timeout apropiado para health check de Gemini? ¿1s, 3s, 5s?
3. ¿Deberíamos implementar circuit breaker para Gemini después de N fallos consecutivos?
