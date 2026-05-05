## Context

El sistema actual maneja clausulados a través de tres paths paralelos que evolucionaron de forma independiente:

1. **ragClauseController** (`/api/rag/clauses`): Path sincrónico que usa Map en memoria para tracking. Los datos se pierden al reiniciar el servidor.
2. **clauseController** (`/api/clauses/*`): Path asincrónico con jobs en memoria. Usa tabla `clause_chunks` con embeddings de 768 dimensiones (modelo antiguo).
3. **documentController** (`/api/documents`): Path transaccional persistente en Supabase. Usa tabla `chunks` con embeddings de 3072 dimensiones, incluye renderizado de páginas a imágenes, y operaciones atómicas.

El frontend (`ClauseAdmin.tsx` y `ClauseSelector.tsx`) usa el path in-memory (`/api/rag/clauses`), lo que causa pérdida de datos y obliga a los brokers a subir clausulados repetidamente.

## Goals / Non-Goals

**Goals:**
- Consolidar en un único path persistente (`documentController` + `documentIndexingService`)
- Implementar versionado automático de clausulados (archivar anterior al subir nueva versión)
- Permitir múltiples clausulados activos por aseguradora (General, Particular, Anexos)
- Crear CLI interactivo para carga masiva inicial de 24 aseguradoras
- Migrar frontend a usar API persistente con visualización de versiones
- Reducir costo por auditoría ~55% al eliminar re-indexación repetida

**Non-Goals:**
- No modificar la estructura de las tablas existentes (documents, chunks, insurers)
- No cambiar el proceso de extracción de texto de PDFs
- No modificar el modelo de embeddings (mantener 3072 dims con gemini-embedding-001 por ahora)
- No implementar sistema de aprobación multi-nivel para uploads
- No migrar datos históricos de `clause_chunks` a `chunks`

## Decisions

### 1. Consolidar en documentController como path único

**Decisión:** Eliminar `ragClauseController` y `clauseController`, quedando solo `documentController`.

**Rationale:**
- `documentController` es el único path con transacciones atómicas
- Usa la tabla `chunks` con dimensiones correctas (3072)
- Incluye renderizado de páginas a imágenes (evidencia visual)
- Persistencia real en Supabase (no se pierde en reinicios)

**Alternativas consideradas:**
- Unificar en `clauseController`: Rechazado porque usa tabla legacy con dimensiones incorrectas
- Mantener ambos: Rechazado porque aumenta complejidad y confusión

### 2. Versionado por insurer + document_type + product_name

**Decisión:** La clave de unicidad para versionado es combinación de `insurer_id + document_type + product_name`.

**Rationale:**
- Una aseguradora puede tener múltiples productos (PYME, Empresarial, etc.)
- Cada producto puede tener múltiples tipos de documento (General, Particular, Anexo)
- Al subir nuevo documento con misma combinación, se archiva el anterior

**Ejemplo:**
```
AXA + CLAUSULADO_GENERAL + "Póliza PYME" → Activo (v2024.1)
AXA + CLAUSULADO_PARTICULAR + "Póliza PYME" → Activo (v2024.1) 
AXA + CLAUSULADO_GENERAL + "Seguro Empresarial" → Activo (v2024.1)
```

### 3. Soft delete con is_active vs Hard delete

**Decisión:** Usar campo `is_active` (boolean) para archivar versiones anteriores, no eliminar físicamente.

**Rationale:**
- Permite recuperar versiones históricas si es necesario
- Mantiene integridad referencial en analysis_history
- Los chunks archivados no se incluyen en búsquedas RAG por defecto

**Implementación:**
```sql
-- Al subir nueva versión
UPDATE documents SET is_active = false 
WHERE insurer_id = ? AND document_type = ? AND product_name = ? AND is_active = true;

-- Insertar nueva versión como activa
INSERT INTO documents (...) VALUES (...) -- is_active = true
```

### 4. CLI interactivo vs Batch automático

**Decisión:** CLI interactivo que pregunta metadatos por cada archivo.

**Rationale:**
- Los nombres de archivos no siempre contienen toda la metadata necesaria
- Permite corrección humana de datos extraídos automáticamente
- Soporta modo batch via manifest.json para ejecuciones repetibles

**Flujo interactivo:**
```
[1/24] Clausulado - AXA Colpatria.pdf
   Aseguradora detectada: AXA Colpatria
   ¿Correcto? (s/n): s
   Nombre del producto: Póliza PYME
   Versión: 2024.1
   Tipo (1=General, 2=Particular, 3=Anexo): 1
   → Indexando... 45 chunks creados ✓
```

### 5. Migración progresiva del frontend

**Decisión:** Migrar componentes en dos fases.

**Fase 1 (Backend primero):**
- Consolidar controllers
- Agregar versionado a documentController
- Crear CLI seed

**Fase 2 (Frontend):**
- Actualizar clauseService.ts con nuevos métodos
- Rediseñar ClauseAdmin.tsx
- Rediseñar ClauseSelector.tsx
- Eliminar métodos legacy

**Rationale:**
- Permite probar API antes de cambiar UI
- Reduce riesgo de regresión
- Facilita rollback si es necesario

## Risks / Trade-offs

**Riesgo:** Pérdida temporal de funcionalidad durante migración
→ **Mitigación:** Mantener endpoints `/api/rag/*` como deprecated durante 1 sprint, redirigiendo a `/api/documents`

**Riesgo:** Brokers confundidos por nuevo flujo de selección
→ **Mitigación:** Mantener modo "upload tradicional" como opción secundaria en ClauseSelector

**Riesgo:** Espacio de almacenamiento crece con versiones históricas
→ **Mitigación:** Implementar job de limpieza mensual que archiva versiones > 2 años (mantener metadata, eliminar chunks)

**Riesgo:** Inconsistencia si múltiples admins suben simultáneamente
→ **Mitigación:** Usar transacciones atómicas en PostgreSQL (ya implementado en documentIndexingService)

**Trade-off:** Complejidad de UI vs Flexibilidad
- Con múltiples clausulados por aseguradora, la UI de selección es más compleja
- Solución: Grupos collapsibles por aseguradora, con checkboxes por documento

## Migration Plan

### Fase 1: Backend Consolidation (Semana 1)
1. Modificar `documentController.createDocument` para implementar auto-archivado
2. Agregar query param `latest` a `documentController.listDocuments`
3. Crear script `seedClauses.ts` con CLI interactivo
4. Probar seed con 7 clausulados de carpeta `/Ejemplos/`
5. Marcar endpoints `/api/rag/*` como deprecated (agregar warning header)

### Fase 2: Frontend Migration (Semana 2)
1. Actualizar `services/clauseService.ts` con métodos para `/api/documents`
2. Rediseñar `ClauseAdmin.tsx` con visualización de versiones
3. Rediseñar `ClauseSelector.tsx` con soporte multi-select
4. Actualizar `App.tsx` si es necesario

### Fase 3: Cleanup (Semana 3)
1. Eliminar `ragClauseController.ts`
2. Eliminar `clauseController.ts`
3. Eliminar métodos legacy de `clauseService.ts`
4. Actualizar documentación de API

### Rollback Strategy
- Mantener backup de controllers eliminados en branch `backup/legacy-clause-controllers`
- Si hay problemas, restaurar endpoints `/api/rag/*` temporalmente
- Los datos en Supabase no se ven afectados por rollback de código

## Open Questions

1. **¿Se debe migrar embedding model a gemini-embedding-2?** 
   - Actualmente usa gemini-embedding-001 (3072 dims)
   - gemini-embedding-2 tiene mejor calidad pero requiere regenerar todos los embeddings
   - Decisión: Posponer a post-migración

2. **¿Cuántas versiones históricas mantener?**
   - Opción A: Ilimitadas (crece storage)
   - Opción B: Últimas 3 por producto
   - Opción C: Últimas 2 años
   - Pendiente: Definir política de retención

3. **¿Necesitamos soft delete para aseguradoras (insurers)?**
   - Actualmente no hay campo `is_active` en insurers
   - Si una aseguradora deja de operar, ¿ocultarla del selector?
   - Pendiente: Agregar campo si es necesario
