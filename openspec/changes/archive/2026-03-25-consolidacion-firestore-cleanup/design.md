# Design: Consolidación Firestore Cleanup

## Overview
Este diseño detalla la estrategia técnica para eliminar código muerto de Firestore y consolidar toda la arquitectura backend en Supabase.

## Architecture After Cleanup

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLEAN ARCHITECTURE (Supabase Only)          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API Layer (Express Routes)                             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ✅ POST   /api/documents          [documentController] │   │
│  │  ✅ GET    /api/documents          [documentController] │   │
│  │  ✅ GET    /api/documents/:id      [documentController] │   │
│  │  ✅ DELETE /api/documents/:id      [documentController] │   │
│  │  ✅ GET    /api/documents/:id/chunks                  │   │
│  │  ✅ POST   /api/search             [searchController]   │   │
│  │  ✅ POST   /api/search/by-coverage                      │   │
│  │  ✅ POST   /api/search/compare                          │   │
│  │  ✅ POST   /api/analyze            [analysisController] │   │
│  │  ✅ GET    /api/history            [analysisController] │   │
│  │  ❌ REMOVED: /api/clauses/*        [clauseController]   │   │
│  │  ❌ REMOVED: /api/rag/*            (consolidated)       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Services Layer (Supabase Only)                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ✅ documentIndexingService.ts                          │   │
│  │  ✅ semanticChunker.ts                                 │   │
│  │  ✅ pdfExtractor.ts                                    │   │
│  │  ✅ pdfRenderer.ts                                     │   │
│  │  ✅ thesaurusService.ts                                │   │
│  │  ✅ vector/embeddingService.ts  (consolidated)         │   │
│  │  ✅ vectorStore.ts                                     │   │
│  │  ✅ ragRetrieval.ts                                    │   │
│  │  ❌ REMOVED: firestore.ts                              │   │
│  │  ❌ REMOVED: clauseLibrary.ts                          │   │
│  │  ❌ REMOVED: embeddingService.ts (duplicated)          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Database Layer (Supabase)                              │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ✅ PostgreSQL + pgvector                               │   │
│  │  ✅ Tables: insurers, documents, chunks, page_images   │   │
│  │  ✅ Storage Bucket: clause-pages                        │   │
│  │  ❌ REMOVED: Firestore collections                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Migration Strategy: Delete, Don't Migrate

**Decision**: No migrar datos históricos de Firestore.

**Rationale**:
- Firestore ya está deshabilitado en producción
- Los datos históricos son de análisis pasados (no críticos)
- Complejidad de migración > Valor de datos
- Empezar desde cero elimina deuda técnica

**Impact**:
- Historial de análisis empieza vacío después del deploy
- Usuarios pierden acceso a análisis antiguos (aceptable)

### 2. Endpoint Consolidation

**Current State**:
```
/api/clauses/*        → Firestore (legacy)
/api/rag/*           → Supabase (new)
/api/documents/*     → Supabase (new)
```

**Target State**:
```
/api/documents/*     → Supabase (consolidated)
/api/search/*        → Supabase (consolidated)
```

**Handling `/api/insurers`**:
- **Research needed**: Verificar si frontend usa este endpoint
- **If YES**: Mover lógica a `documentController` o crear `insurerController`
- **If NO**: Eliminar sin reemplazo

### 3. Service Consolidation

**Embedding Services**:
- **Current**: `services/embeddingService.ts` (viejo) + `services/vector/embeddingService.ts` (nuevo)
- **Target**: Eliminar el viejo, mantener solo `services/vector/embeddingService.ts`
- **Refactor**: Verificar quién importa el viejo y actualizar imports

### 4. History Migration (analysisController)

**Current Implementation** (Firestore):
```typescript
// Lines 108-124
const { firestoreService } = require('../services/firestore');
await firestoreService.saveAnalysis(userId, clientName, result);

// Lines 157-173  
const history = await firestoreService.getHistoryByUser(userId);
```

**New Implementation** (Supabase):
```typescript
// Option A: Use existing supabase client
const { supabase } = require('../config/database');
await supabase.from('analysis_history').insert({...});

// Option B: Create analysisHistoryService
const { analysisHistoryService } = require('../services/analysisHistoryService');
await analysisHistoryService.save(userId, clientName, result);
```

**Decision**: Option A (simple, direct) para empezar. Considerar Option B si crece la lógica.

### 5. Database Schema Addition

**New Table: `analysis_history`**
```sql
CREATE TABLE analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX idx_analysis_history_user_id ON analysis_history(user_id);
CREATE INDEX idx_analysis_history_created_at ON analysis_history(created_at DESC);
```

## Deletion Plan

### Phase 1: Preparation
1. **Verify frontend usage** of `/api/insurers`
2. **Check all imports** of files to be deleted
3. **Create database migration** for analysis_history

### Phase 2: Migration
1. **Modify analysisController.ts**:
   - Replace Firestore imports with Supabase
   - Update saveAnalysis logic
   - Update getHistory logic
2. **Update index.ts**:
   - Remove clauseController routes
   - Consolidate rag routes if needed

### Phase 3: Cleanup
1. **Delete files**:
   - `server/src/services/firestore.ts`
   - `server/src/services/clauseLibrary.ts`
   - `server/src/services/embeddingService.ts` (old)
   - `server/src/controllers/clauseController.ts`
   - `server/src/scripts/test_clause_library.ts`
   - `server/src/scripts/test_library_analysis.ts`
   - `server/src/scripts/test_section_extraction.ts`
2. **Update package.json**:
   - Remove `firebase-admin` dependency
3. **Update .env.example**:
   - Remove Firestore-related variables

### Phase 4: Verification
1. **Run tests**: `npm test` (if available)
2. **Type check**: `npx tsc --noEmit`
3. **Build**: `npm run build`
4. **Test endpoints**: Manual verification of key flows

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Frontend uses `/api/insurers` | Medium | High | Verify before deletion, create replacement if needed |
| Missing import updates | Medium | Medium | Global search for imports, type checking |
| Breaking changes in routes | Low | High | Keep API surface minimal, test thoroughly |
| firebase-admin used elsewhere | Low | High | Global grep for firebase references |

## Success Metrics

- [ ] `firebase-admin` removed from package.json
- [ ] Zero TypeScript errors after deletion
- [ ] Build succeeds
- [ ] Key endpoints respond correctly:
  - POST /api/analyze
  - GET /api/history
  - POST /api/documents
  - GET /api/documents

## Future Considerations

After cleanup, consider:
1. **Consolidating RAG routes**: `/api/rag/*` could merge into `/api/documents/*`
2. **Code organization**: Reorganizar services/ si hay más cleanup
3. **Testing**: Agregar tests para los servicios que quedan
