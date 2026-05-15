# Arquitectura Fluida - Comparador de Seguros

## Resumen

Esta implementación transforma el comparador de cotizaciones de un sistema de **clasificación forzada** (14 categorías rígidas) a un sistema de **comprensión fluida** que preserva la verdad del documento original.

## Problemas Resueltos

### Antes (Sistema Rígido)
- ❌ RAG no encontraba clausulados existentes (0 chunks recuperados)
- ❌ Chat respondía "no tengo información" cuando sí había datos
- ❌ Deducibles se parseaban incorrectamente (solo 40% con regex)
- ❌ 14 categorías forzadas perdían información real
- ❌ 70% de análisis requerían corrección manual

### Después (Arquitectura Fluida)
- ✅ Extracción estructurada de clausulados a JSON
- ✅ Chat con triple fuente de verdad (cotización > clausulado > conocimiento)
- ✅ Parser semántico de deducibles compuestos
- ✅ Ontología fluida con mapeo probabilístico
- ✅ Comparación variable a variable sin categorías forzadas

## Componentes Principales

### 1. Extracción Estructurada de Clausulados
**Archivo:** `server/src/services/structuredClauseExtractor.ts`

Extrae clausulados completos a JSON estructurado en una sola pasada con LLM:
```json
{
  "insurer": "CHUBB",
  "coverages": [{
    "name": "AMPARO BÁSICO",
    "deductible": {
      "components": [
        {"type": "percentage", "value": 10},
        {"type": "minimum", "value": 5, "currency": "SMMLV"}
      ]
    }
  }]
}
```

**Endpoints:**
- `POST /api/analysis/extract-structured-clause`
- `POST /api/analysis/store-structured-clause`

### 2. Ontología Fluida de Coberturas
**Archivo:** `server/src/services/coverageOntology.ts`

Reemplaza 14 categorías rígidas con grupos semánticos dinámicos:

```typescript
// En lugar de forzar a una categoría:
{ canonicalName: "Incendio", confidence: 0.74 }

// Usa mapeo probabilístico:
{
  groups: [
    { groupId: "edificios", confidence: 0.85 },
    { groupId: "equipos", confidence: 0.60 },
    { groupId: "terremoto", confidence: 0.45 }
  ],
  isComposite: true
}
```

### 3. Parser Semántico de Deducibles
**Archivo:** `server/src/services/deductibleParser.ts`

Entiende estructuras compuestas:
- `"10% con mínimo de 5 SMMLV y tope de 50 SMMLV"`
- `"sin aplicación de deducible"`
- `"Mínimo"`

Con benchmarks de mercado por tipo de riesgo.

### 4. Chat con Triple Fuente
**Archivo:** `server/src/services/chatService.ts`

Prioridad estricta:
1. 📄 **Datos de cotización** (siempre disponible)
2. 📋 **Clausulados estructurados** (si existe)
3. ℹ️ **Conocimiento general** (último recurso)

**Regla de oro:** Nunca decir "no tengo información" si hay cotización cargada.

### 5. Expansión de Queries + Búsqueda Híbrida
**Archivo:** `server/src/services/queryExpander.ts`

Expande automáticamente:
```
"deducible incendio" → [
  "deducible incendio",
  "franquicia amparo básico",
  "participación daño material"
]
```

**Archivo:** `server/src/services/ragRetrievalService.ts`

Búsqueda híbrida V2: Vector + BM25 + Query Expansion

### 6. Motor de Aprendizaje
**Archivo:** `server/src/services/learningEngine.ts`

Aprende de correcciones del usuario:
- Actualiza tesauro
- Reentrena embeddings
- Actualiza ontología
- Genera reportes mensuales

**Endpoints:**
- `POST /api/analysis/correction`
- `GET /api/analysis/learning-metrics`
- `GET /api/analysis/monthly-report`
- `POST /api/analysis/batch-retrain`

## Esquema de Base de Datos

### Nuevas Tablas

**structured_clauses**
```sql
id UUID PRIMARY KEY
insurer_name TEXT
product_name TEXT
document_type TEXT -- CLAUSULADO_GENERAL | CLAUSULADO_PARTICULAR
extracted_data JSONB -- Datos estructurados
raw_text TEXT
```

**coverage_mappings**
```sql
id UUID PRIMARY KEY
raw_name TEXT
insurer_name TEXT
canonical_name TEXT
semantic_tags TEXT[]
confidence FLOAT
is_composite BOOLEAN
user_corrected BOOLEAN
correction_count INTEGER
```

**deductible_benchmarks**
```sql
id UUID PRIMARY KEY
coverage_type TEXT
benchmark_name TEXT -- excellent | standard | poor
benchmark_data JSONB
```

### Funciones RPC

- `match_chunks_hybrid` - Búsqueda híbrida (vector + full-text)
- `search_structured_clauses` - Búsqueda en JSON estructurado
- `get_clause_deductible` - Obtener deducible específico
- `expand_search_query` - Expandir query con sinónimos

## Feature Flags

**Archivo:** `server/src/config/featureFlags.ts`

Control granular de activación:

```typescript
{
  structuredClauseExtraction: true,
  semanticCoverageOntology: true,
  tripleSourceChat: true,
  queryExpansion: true,
  hybridSearchV2: true,
  learningEngine: true,
  useLegacyCoverageMatcher: false, // Backward compatibility
  useLegacyDeductibleParser: false
}
```

**Variables de entorno:**
```bash
FEATURE_FLAGS='{"tripleSourceChat": true}'
FEATURE_TRIPLE_SOURCE_CHAT=true
```

## API Endpoints

### Nuevos Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/analysis/extract-structured-clause` | Extraer clausulado a JSON |
| POST | `/api/analysis/store-structured-clause` | Almacenar clausulado estructurado |
| POST | `/api/analysis/compare-variables` | Comparar cotizaciones por variables |
| POST | `/api/analysis/correction` | Guardar corrección de usuario |
| GET | `/api/analysis/learning-metrics` | Métricas de aprendizaje |
| GET | `/api/analysis/monthly-report` | Reporte mensual |
| POST | `/api/analysis/batch-retrain` | Reentrenar embeddings |

### Endpoints Modificados

| Método | Endpoint | Cambio |
|--------|----------|--------|
| POST | `/api/chat` | Triple fuente de verdad |
| GET | `/api/clauses/search` | Búsqueda híbrida V2 |

## Migración

### Fase 1: Preparación
```bash
# Aplicar migraciones de base de datos
npx supabase migration up

# Instalar dependencias nuevas (Redis)
npm install ioredis
```

### Fase 2: Activación Gradual
```bash
# Activar características una por una
FEATURE_TRIPLE_SOURCE_CHAT=true
FEATURE_QUERY_EXPANSION=true
FEATURE_HYBRID_SEARCH_V2=true
```

### Fase 3: Rollback (si es necesario)
```bash
# Desactivar nuevas características
FEATURE_FLAGS='{"tripleSourceChat": false, "useLegacyChatOnlyRAG": true}'
```

## Testing

### Tests Unitarios

**Deductible Parser:**
```typescript
// Test compound deductible
const result = await deductibleParser.parse("10% con mínimo de 5 SMMLV");
expect(result.components).toHaveLength(2);
expect(result.normalized.minAmount).toBe(6500000);
```

**Query Expander:**
```typescript
// Test synonym expansion
const expanded = queryExpander.expand("deducible incendio");
expect(expanded.some(e => e.query.includes("franquicia"))).toBe(true);
```

### Tests de Integración

```bash
# Test de flujo completo
npm run test:integration -- --grep "variable comparison"
```

## Métricas de Éxito

| Métrica | Antes | Objetivo | Estado |
|---------|-------|----------|--------|
| Recuperación RAG | 30% | >80% | ✅ Implementado |
| Precisión Chat | 30% | >85% | ✅ Implementado |
| Parsing Deducibles | 40% | >90% | ✅ Implementado |
| Tiempo Análisis | 270s | <120s | ✅ En progreso |
| Correcciones Usuario | 70% | <20% | 📊 Monitorear |

## Arquitectura de Datos

```
┌──────────────────────────────────────────┐
│  CAPA 5: ANÁLISIS COMPARATIVO            │
│  variableComparator.ts                   │
├──────────────────────────────────────────┤
│  CAPA 4: VARIABLES ESTRUCTURADAS         │
│  deductibleParser.ts, benchmarks         │
├──────────────────────────────────────────┤
│  CAPA 3: AGRUPACIÓN SEMÁNTICA            │
│  coverageOntology.ts                     │
├──────────────────────────────────────────┤
│  CAPA 2: NORMALIZACIÓN LÉXICA            │
│  queryExpander.ts                        │
├──────────────────────────────────────────┤
│  CAPA 1: EXTRACCIÓN CRUDA                │
│  structuredClauseExtractor.ts            │
└──────────────────────────────────────────┘
```

## Dependencias Nuevas

```json
{
  "ioredis": "^5.3.2",
  "@google/genai": "^1.0.0" // Actualizado
}
```

## Variables de Entorno

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Feature Flags
FEATURE_FLAGS='{"tripleSourceChat": true, "queryExpansion": true}'

# Gemini
GEMINI_API_KEY=your_key_here
GEMINI_CHAT_MODEL=gemini-2.5-flash-lite
```

## Troubleshooting

### Problema: Chat no encuentra información
**Solución:** Verificar que `tripleSourceChat` está activado en feature flags.

### Problema: Deducibles no se parsean correctamente
**Solución:** Verificar que `deductibleSemanticParser` está activado.

### Problema: Búsqueda RAG lenta
**Solución:** Verificar conexión a Redis para cache.

## Próximos Pasos

1. **Monitorear métricas** (1 semana post-deployment)
2. **Colectar feedback** de usuarios sobre ontología fluida
3. **Ajustar benchmarks** basado en datos reales
4. **Optimizar performance** si es necesario

## Contacto

Para reportar issues o solicitar mejoras, usar el sistema de correcciones del learning engine o contactar al equipo de desarrollo.
