# Design: Corrección Cotización Allianz y Optimización de Normalización

## Overview

Este cambio soluciona tres problemas críticos:
1. **Extracción de Allianz**: El formato de condiciones descriptivas no es soportado
2. **Normalización lenta**: 7 segundos por cobertura debido a llamadas individuales a Gemini API
3. **Timeouts insuficientes**: 2 minutos fijos no alcanzan para cotizaciones grandes (17-22 coberturas)

## Technical Decisions

### Decision 1: Batch Embeddings via Gemini API

**Approach**: Enviar múltiples textos en una sola llamada a Gemini para generar embeddings en batch.

**Rationale**: 
- Gemini API soporta múltiples inputs en una sola llamada
- Reduce N llamadas a ~N/10 llamadas
- De 7s por cobertura a ~7s por batch de 10

**Implementation**:
```typescript
// Nuevo método en embeddingService
async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await gemini.embedContent({
    model: 'gemini-embedding-001',
    contents: texts, // Array de textos
  });
  return response.embeddings; // Array de embeddings
}
```

**Alternative considered**: Usar una librería local de embeddings (como sentence-transformers). Rejected porque requiere infraestructura adicional y no garantiza calidad equivalente a Gemini.

### Decision 2: Persistent Cache en Supabase

**Approach**: Tabla `coverage_embeddings_cache` con columnas para nombre normalizado, embedding (JSONB o vector), modelo, y timestamps.

**Rationale**:
- Supabase ya está configurado y es persistente
- pgvector extension permite búsquedas vectoriales eficientes
- Los embeddings nunca cambian para el mismo texto + modelo

**Schema**:
```sql
CREATE TABLE coverage_embeddings_cache (
  id SERIAL PRIMARY KEY,
  coverage_name TEXT NOT NULL,
  embedding JSONB NOT NULL,
  model TEXT NOT NULL DEFAULT 'gemini-embedding-001',
  dimensions INTEGER NOT NULL DEFAULT 3072,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(coverage_name, model)
);
CREATE INDEX idx_coverage_name ON coverage_embeddings_cache(coverage_name);
```

**Alternative considered**: Redis. Rejected porque ya decidimos hacer Redis opcional; usar Supabase evita agregar dependencia.

### Decision 3: Hybrid Matching con Prioridad Estricta

**Approach**: Mantener el orden de capas exacto pero optimizar:
1. Thesaurus exacto (O(1) lookup)
2. Fuzzy matching (rápido, <1ms por cobertura)
3. Cache persistente (query a Supabase, <50ms)
4. Batch embedding (solo para coberturas no cacheadas)
5. LLM fallback (solo para confianza < 0.6)

**Rationale**:
- ~80% de coberturas comunes se resuelven en capas 1-2 sin API
- Capa 3 (cache) resuelve coberturas ya vistas sin costo
- Solo ~10-20% necesitan embeddings batch
- Esto reduce drásticamente llamadas a API

### Decision 4: Nuevo Format Family `CONDITIONS`

**Approach**: Agregar formato `CONDITIONS` al detector de formatos con patrones específicos para documentos de condiciones contractuales.

**Detection patterns**:
- "COBERTURA BÁSICA" + "COBERTURAS ESPECIFICAS"
- Secciones numeradas (7., 8., 9.)
- Bullets (✓) con descripciones de coberturas
- "condiciones del contrato" / "condiciones particulares"

**Prompt specialization**:
El prompt para CONDITIONS instruirá a Gemini a:
- Extraer cada bullet como cobertura individual
- Usar la sección padre como contexto
- Buscar deducibles en secciones aparte
- Inferir valores asegurados del total del encabezado

### Decision 5: Timeout Dinámico

**Approach**: Fórmula basada en número de coberturas:
```typescript
const timeout = Math.min(300, Math.max(120, 30 + coverageCount * 3));
```

**Rationale**:
- Cotizaciones pequeñas (5 coberturas): 120s (mínimo)
- Cotizaciones medianas (15 coberturas): 120s
- Cotizaciones grandes (22 coberturas): ~156s
- Cotizaciones muy grandes (50+): 300s (máximo)

### Decision 6: Graceful Degradation

**Approach**: Si una cotización timeout, continuar con las demás y generar comparación parcial.

**Implementation**:
- Wrap cada cotización en try/catch independiente
- Al timeout: loggear, marcar como failed, continuar loop
- En resultado final: mostrar "No disponible" para cotizaciones fallidas
- Incluir warning en UI: "Análisis incompleto"

## Architecture Changes

### Modified Services

1. **formatDetector.ts**
   - Agregar `CONDITIONS` a `FormatFamily` union type
   - Agregar patrones de detección para Allianz
   - Weight: 0.95 (igual que DESCRIPTIVE)

2. **promptBuilder.ts**
   - Agregar template `CONDITIONS` con instrucciones para texto descriptivo
   - Ejemplos few-shot de extracción de bullets
   - Instrucciones para deducibles en secciones separadas

3. **semanticMatcher.ts**
   - Nuevo método `normalizeBatch(coverages: string[]): Promise<MatchResult[]>`
   - Integrar cache persistente (check Supabase antes de API)
   - Usar batch embeddings para coverages no cacheadas
   - Mantener el mismo orden de capas

4. **coverageNormalizer.ts**
   - Agregar cache lookup antes de normalización
   - Usar batch processing para embeddings
   - Fallback a LLM individual solo si es necesario

5. **analysisController.ts**
   - Implementar timeout dinámico
   - Agregar graceful degradation (try/catch por cotización)
   - Calcular timeout basado en número de coberturas extraídas

### New Services

1. **embeddingCacheService.ts**
   - `getCachedEmbedding(name: string): Promise<number[] | null>`
   - `setCachedEmbedding(name: string, embedding: number[]): Promise<void>`
   - `getBatch(coverageNames: string[]): Promise<Map<string, number[]>>`
   - Usa Supabase con fallback a memoria

## Migration Plan

1. **Database Migration** (antes de deploy)
   - Crear tabla `coverage_embeddings_cache`
   - Agregar índices
   - Verificar extensión pgvector

2. **Code Deploy** (backward compatible)
   - Deploy de servicios modificados
   - Cache persistente empieza vacío (se llena gradualmente)
   - Format detection con CONDITIONS
   - Timeout dinámico activo

3. **Validation**
   - Test con Allianz EDUCAMOS
   - Test con HDI (17 coverages)
   - Test con SBS (22 coverages)
   - Verificar tiempos de normalización

## Performance Targets

| Quote Size | Before | After (Batch) | After (Hybrid) |
|-----------|--------|---------------|----------------|
| 5 coverages | 35s | 14s | 5s |
| 15 coverages | 105s | 28s | 15s |
| 22 coverages | 154s | 35s | 20s |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Batch API returns inconsistent results | Test extensively with known inputs; validate embedding dimensions |
| Supabase cache becomes bottleneck | Add in-memory LRU cache layer; monitor query times |
| CONDITIONS format detection false positives | Tune patterns; allow manual override |
| Dynamic timeout too short for complex quotes | Formula is conservative (3s/coverage); max 5min |
| Allianz extraction still incomplete | Add specific examples to prompt; iterate based on results |

## Files to Modify

- `server/src/services/formatDetector.ts`
- `server/src/services/promptBuilder.ts`
- `server/src/services/semanticMatcher.ts`
- `server/src/services/coverageNormalizer.ts`
- `server/src/controllers/analysisController.ts`
- `server/src/services/cache/embeddingCacheService.ts` (NEW)
- `server/src/services/vector/embeddingService.ts`
- Supabase migration: `supabase/migrations/..._coverage_embeddings_cache.sql`
