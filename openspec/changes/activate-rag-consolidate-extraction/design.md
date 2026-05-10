## Context

El sistema Comparador PYME actualmente tiene una arquitectura vectorial fragmentada:
- Tabla `chunks` (3072 dims): Usada por `DocumentIndexingService` para documentos principales
- Tabla `clause_chunks` (768 dims): Usada por servicios RAG (`ragRetrievalService`, `clauseCoverageValidator`)
- Los clausulados subidos van a `chunks` pero NUNCA a `clause_chunks` (job async no se ejecuta)
- Resultado: `clause_chunks` está vacía (0 registros) y todos los servicios RAG fallan

Adicionalmente, la extracción de cotizaciones usa un prompt genérico que no entiende los formatos variables de diferentes aseguradoras (BBVA, SBS, MAPFRE, etc.), generando ~80% de datos erróneos.

## Goals / Non-Goals

**Goals:**
1. Activar el sistema RAG indexando clausulados existentes y nuevos
2. Consolidar almacenamiento vectorial en una sola tabla (`chunks`)
3. Mejorar precisión de extracción de cotizaciones a >90%
4. Implementar memoria persistente para el chat

**Non-Goals:**
- No modificar la UI del frontend (solo mejoran los datos)
- No cambiar el modelo de embeddings (mantener gemini-embedding-001)
- No implementar OCR para PDFs escaneados (ya es non-goal del sistema)
- No cambiar el pipeline de scoring de cotizaciones

## Decisions

### 1. Consolidar en `chunks` vs mantener `clause_chunks`

**Decisión**: Migrar todo RAG a usar tabla `chunks` con 3072 dimensiones.

**Rationale**:
- `chunks` ya tiene datos (102 registros) y funciona correctamente
- Elimina duplicación de embeddings (ahorro de costos y complejidad)
- Dimensiones 3072 son las correctas para gemini-embedding-001
- Un solo punto de verdad para todos los documentos

**Alternativas consideradas**:
- Mantener ambas tablas: Rechazado por complejidad innecesaria
- Migrar `chunks` a 768 dims: Rechazado por pérdida de información

### 2. Usar `gemini-2.5-pro` para extracción

**Decisión**: Migrar extracción estructurada de `gemini-2.5-flash` a `gemini-2.5-pro`.

**Rationale**:
- Mejor precisión en tablas complejas y formatos variables
- Contexto de 1M tokens suficiente para cotizaciones largas (BBVA = 45k chars)
- Costo aceptable para volumen esperado (<100 cotizaciones/día)

**Alternativas consideradas**:
- Mantener Flash y mejorar prompts: Rechazado, pruebas muestran que Flash alucina con tablas complejas
- Usar Claude 3.5 Sonnet: Rechazado, requeriría cambio de proveedor y nueva integración

### 3. Perfiles por aseguradora vs prompt único

**Decisión**: Implementar sistema de perfiles (`InsurerExtractionProfile`) con prompts específicos por aseguradora.

**Rationale**:
- Cada aseguradora usa formato propio (tablas, columnas, nombres de coberturas)
- Few-shot examples por aseguradora mejoran drásticamente la precisión
- Permite validación específica por formato (rangos de prima, deducibles típicos)

**Implementación**:
```typescript
interface InsurerExtractionProfile {
  insurerName: string;
  formatPatterns: RegExp[];
  promptTemplate: string;  // Prompt específico con few-shot examples
  coverageMapping: Record<string, string>;  // Mapeo de nombres a canónicos
  validationRules: ValidationRule[];
}
```

### 4. Chat memory: DB vs in-memory

**Decisión**: Persistir conversaciones en Supabase (`chat_threads` + `chat_messages`).

**Rationale**:
- Memoria entre sesiones (usuario puede retomar conversación)
- Análisis de uso y mejora continua del chat
- No depende del estado del servidor

## Risks / Trade-offs

### [Riesgo] Breaking change en funciones SQL
**Mitigación**: Crear nuevas funciones (`match_chunks_unified`) y mantener las antiguas durante transición. Rollback: usar funciones antiguas.

### [Riesgo] Costo de gemini-2.5-pro
**Mitigación**: Monitorear uso. Si es excesivo, fallback a Flash con perfiles mejorados. Cachear resultados de extracción por hash de PDF.

### [Riesgo] Perfiles incompletos para nuevas aseguradoras
**Mitigación**: Perfil genérico como fallback. Sistema de retroalimentación para agregar nuevos perfiles.

### [Riesgo] Pérdida de datos al deprecar `clause_chunks`
**Mitigación**: Tabla `clause_chunks` se marca como deprecated pero NO se elimina inmediatamente. Script de backup antes de cualquier cambio.

## Migration Plan

### Fase 1: Reindexación (0 downtime)
1. Ejecutar `scripts/reindex-clauses.ts` para SBS y HDI
2. Subir clausulados de ejemplo adicionales vía API
3. Verificar `clause_chunks` tiene datos

### Fase 2: Consolidación Vectorial (low downtime)
1. Crear funciones SQL nuevas (`match_chunks_unified`)
2. Actualizar `ragRetrievalService` para usar nueva función
3. Deploy con feature flag `USE_UNIFIED_RAG=true`
4. Monitorear 24h
5. Remover funciones antiguas y marcar `clause_chunks` como deprecated

### Fase 3: Mejorar Extracción (0 downtime)
1. Implementar `InsurerProfileService` con perfiles base
2. Cambiar modelo a `gemini-2.5-pro` en `gemini.ts`
3. Feature flag `USE_PRO_MODEL=true`
4. A/B testing: comparar precisión Flash vs Pro
5. Rollout gradual

### Fase 4: Chat Memory (0 downtime)
1. Crear migraciones SQL para tablas de chat
2. Implementar persistencia en `chatService.ts`
3. Deploy

### Rollback Strategy
- Feature flags para cada fase permiten rollback inmediato
- `clause_chunks` se mantiene intacta durante transición
- Funciones SQL antiguas disponibles hasta confirmar estabilidad

## Open Questions

1. ¿Cuál es el presupuesto mensual aceptable para Gemini API? (Pro es ~2x costo de Flash)
2. ¿Se requiere retención de historial de chat por tiempo específico? (GDPR, regulación)
3. ¿Hay aseguradoras adicionales no consideradas en los ejemplos?
