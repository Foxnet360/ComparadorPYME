# Librería de Clausulados Versionada - Guía Técnica

## Visión General

La librería de clausulados ha sido consolidada en un sistema único persistente basado en `documentController` y la tabla `documents` de Supabase. Este sistema reemplaza los tres paths paralelos anteriores:

1. ❌ `ragClauseController` (in-memory, datos perdidos al reiniciar)
2. ❌ `clauseController` (legacy, embeddings 768d)
3. ✅ `documentController` (persistente, transacciones atómicas, embeddings 3072d)

## Arquitectura de Versionado

### Clave de Unicidad

Cada documento se identifica únicamente por la combinación:
- `insurer_id` + `document_type` + `product_name`

Esto permite:
- Múltiples productos por aseguradora (PYME, Empresarial, etc.)
- Múltiples tipos de documento por producto (General, Particular, Anexo)
- Una versión activa por combinación (auto-archive al subir nueva)

### Estados de Documento

```
Activo (is_active = true)     →  Visible en búsquedas RAG
Archivado (is_active = false)  →  Conservado pero excluido de búsquedas
```

### Flujo de Versionado Automático

```
Usuario sube: AXA + CLAUSULADO_GENERAL + "Póliza PYME" v2024.2
    ↓
Sistema busca versión activa existente
    ↓
Si existe: Archiva versión anterior (is_active = false)
    ↓
Inserta nueva versión (is_active = true)
    ↓
Retorna: ID nuevo + ID versión archivada
```

## API Endpoints

### Documentos (Nuevo - Recomendado)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/documents` | Subir nuevo documento (con auto-archive) |
| GET | `/api/documents` | Listar documentos (con filtros) |
| GET | `/api/documents/:id` | Obtener documento específico |
| DELETE | `/api/documents/:id` | Eliminar documento |

**Parámetros de Query:**
- `insurerId`: Filtrar por aseguradora
- `documentType`: Filtrar por tipo (CLAUSULADO_GENERAL, CLAUSULADO_PARTICULAR, ANEXO)
- `isActive`: true/false
- `latest`: true (solo última versión activa por combinación)
- `limit` & `offset`: Paginación

### Endpoints Legacy (Deprecados)

| Método | Endpoint | Estado |
|--------|----------|--------|
| POST | `/api/rag/clauses` | ⚠️ Deprecated - Sunset: 2025-05-31 |
| GET | `/api/rag/clauses` | ⚠️ Deprecated - Sunset: 2025-05-31 |
| DELETE | `/api/rag/clauses` | ⚠️ Deprecated - Sunset: 2025-05-31 |

Los endpoints legacy ahora incluyen headers:
```
Deprecation: true
Sunset: Sat, 31 May 2025 00:00:00 GMT
Link: </api/documents>; rel="successor-version"
```

## Estructura de Datos

### Tabla `documents`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| insurer_id | UUID | Referencia a aseguradora |
| document_name | TEXT | Nombre del documento |
| document_type | ENUM | Tipo: CLAUSULADO_GENERAL, CLAUSULADO_PARTICULAR, ANEXO, COTIZACION |
| product_name | TEXT | Nombre del producto/ramo |
| version | TEXT | Versión (ej: 2024.1) |
| total_pages | INTEGER | Total de páginas |
| is_active | BOOLEAN | Estado (true=activo, false=archivado) |
| created_at | TIMESTAMP | Fecha de creación |
| updated_at | TIMESTAMP | Fecha de actualización |

### Constraints

```sql
-- Única versión activa por combinación
UNIQUE (insurer_id, document_type, product_name) WHERE is_active = true

-- Tipos válidos
CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION', 'ANEXO'))
```

## Frontend

### Componentes Actualizados

- **ClauseAdmin**: Panel de administración con versiones, estados, filtros
- **ClauseSelector**: Selector multi-cláusula por aseguradora con tipos

### Servicio Actualizado

`clauseService` ahora incluye métodos `getDocuments()`, `createDocument()`, `deleteDocument()` con los métodos legacy marcados como deprecados.

## Scripts

### Carga Masiva Inicial

```bash
# Modo interactivo (pregunta metadatos por cada archivo)
npm run seed:clauses

# Generar manifest de ejemplo
npm run seed:clauses -- --generate-manifest

# Modo batch (usando manifest editado)
npm run seed:clauses -- --manifest=manifest.json

# Resumir (saltar archivos ya procesados)
npm run seed:clauses -- --manifest=manifest.json --resume
```

## Ventajas del Nuevo Sistema

1. **Persistencia Real**: Los datos sobreviven reinicios del servidor
2. **Versionado Automático**: No más re-indexación manual
3. **Múltiples Documentos por Aseguradora**: General, Particular, Anexos simultáneos
4. **Transacciones Atómicas**: Documento + imágenes + chunks se guardan juntos
5. **Embeddings Correctos**: 3072 dimensiones con gemini-embedding-001
6. **Renderizado Visual**: Páginas renderizadas a imágenes para evidencia
7. **Reducción de Costos**: ~55% menos re-indexaciones repetidas

## Migración desde Sistema Anterior

### Para Desarrolladores

1. Actualizar llamadas de `/api/rag/clauses` a `/api/documents`
2. Usar `clauseService.getDocuments()` en lugar de `ragGetClauses()`
3. Incluir `productName` en uploads cuando aplique

### Para Administradores

1. Subir clausulados existentes vía `npm run seed:clauses`
2. Verificar en ClauseAdmin que versiones se muestran correctamente
3. Entrenar brokers en el nuevo selector multi-cláusula