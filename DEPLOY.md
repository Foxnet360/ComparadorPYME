# Guía de Despliegue en Railway

## Despliegue Automático

Este proyecto usa Docker multi-stage build en Railway. El proceso es automático:

1. Haz `git push` a la rama principal
2. Railway detecta el cambio
3. Construye frontend y backend dentro del contenedor
4. Despliega la aplicación

**No necesitas compilar localmente antes de pushear.**

---

## Variables de Entorno Requeridas

Configura estas variables en el [dashboard de Railway](https://railway.app):

### Backend (Runtime)
- `GEMINI_API_KEY` - API key de Google Gemini
- `SUPABASE_URL` - URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key de Supabase
- `SUPABASE_ANON_KEY` - Anon key de Supabase
- `GROQ_API_KEY` - API key de Groq (opcional)
- `REDIS_URL` - URL de Redis (opcional, ej: `redis://localhost:6379`). Si no se configura, el sistema usa cache en memoria automáticamente.
- `CLAUSE_PAGES_BUCKET` - Nombre del bucket (default: clause-pages)
- `REGION` - Código de región (default: CO)
- `SMMLV_VALUE` - Valor del salario mínimo (default: 1300000)
- `UVT_VALUE` - Valor UVT (default: 42412)
- `CURRENCY` - Moneda (default: COP)

### Frontend (Build Time)
- `VITE_GEMINI_API_KEY` - Mismo valor que GEMINI_API_KEY (usado durante build)
- `VITE_ENABLE_ADVANCED_ANALYSIS` - Activar análisis avanzado (`true`/`false`)

**Nota:** Railway inyecta estas variables automáticamente tanto en build time como en runtime.

---

## Arquitectura del Contenedor

```
┌─────────────────────────────────────┐
│         Railway Container           │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │  Frontend   │  │   Backend   │  │
│  │  (dist/)    │  │ (server/dist)│ │
│  └─────────────┘  └─────────────┘  │
│         │                │          │
│         └──── Express ───┘          │
│              Puerto 8080            │
└─────────────────────────────────────┘
```

- Express sirve el frontend estático en `/`
- Las APIs están disponibles en `/api/*`
- Health check en `/health`

---

## Desarrollo Local

### Sin Docker (recomendado para desarrollo)

**Terminal 1 - Backend:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
```

El frontend estará en `http://localhost:3000` con proxy al backend.

### Con Docker (para validar producción)

```bash
# Build
docker build -t comparador-csa .

# Run
docker run -p 8080:8080 --env-file .env comparador-csa
```

---

## Troubleshooting

### "Build failed: no such file or directory"
- Verifica que `dist/` y `server/dist/` NO estén en Git (deben construirse en Railway)
- Verifica que `.dockerignore` no excluya archivos fuente necesarios

### "Cannot find module"
- Verifica que `server/package.json` tenga todas las dependencias del backend
- Verifica que `package.json` raíz tenga las dependencias del frontend

### Variables de entorno no disponibles
- Verifica que estén configuradas en Railway Dashboard
- Verifica que el nombre coincida exactamente (case-sensitive)

### Frontend no carga (404)
- Verifica que `NODE_ENV=production` esté configurado
- Verifica que Express esté sirviendo archivos estáticos de `dist/`

### Redis en Railway

#### Configuración Paso a Paso

**✅ Redis ya está creado en tu proyecto Railway.**

Solo necesitas agregar la variable de entorno `REDIS_URL` a tu servicio.

##### Opción 1: Usando Railway Dashboard (Recomendado)

1. Ir a tu servicio principal (`comparador-csa`)
2. Tab **"Variables"** → **"New Variable"**
3. Nombre: `REDIS_URL`
4. Valor (copia y pega):
   ```
   redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@redis.railway.internal:6379
   ```
5. Click **"Add"** y luego **"Deploy"**

##### Opción 2: Usando Railway CLI

**Staging:**
```bash
railway variables --environment staging --set REDIS_URL="redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@redis.railway.internal:6379"
```

**Producción:**
```bash
railway variables --environment production --set REDIS_URL="redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@redis.railway.internal:6379"
```

##### Credenciales de Redis

| Campo | Valor |
|-------|-------|
| **Host** | `redis.railway.internal` |
| **Port** | `6379` |
| **User** | `default` |
| **Password** | `YymaPFEKzRuNdHsyCnElykqZXmuaCkHC` |
| **Internal URL** | `redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@redis.railway.internal:6379` |
| **Public URL** | `redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@kodama.proxy.rlwy.net:42389` |

**Nota:** Usa siempre la **Internal URL** para la comunicación entre servicios en Railway. La Public URL solo es necesaria para conexiones externas (ej: Redis CLI desde tu computadora).

##### Verificar conexión:
```bash
# Ver logs del servicio
railway logs --service comparador-csa

# Deberías ver:
✅ [Redis] Connected and available
```

#### ¿Qué se cachea en Redis?

| Tipo | TTL | Descripción |
|------|-----|-------------|
| Embeddings | 7 días | Vectores de texto para búsqueda |
| Coverage Mapping | 30 días | Mapeo coberturas → categorías |
| Deductibles | 30 días | Deducibles parseados |
| Search Results | 1 hora | Resultados RAG |
| Comparisons | 1 día | Resultados de comparación |

**Sin Redis:** Todo funciona igual, pero usa memoria local (límite: 10,000 entradas).

### "[ioredis] Unhandled error event: AggregateError [ECONNREFUSED]"

**Si ya configuraste REDIS_URL y sigue apareciendo este error:**

#### Diagnóstico

1. **Verificar que REDIS_URL esté configurada:**
   ```bash
   railway variables --service comparador-csa
   # Debería mostrar: REDIS_URL=redis://default:... @redis.railway.internal:6379
   ```

2. **Verificar health check:**
   ```bash
   curl https://tu-app.railway.app/health
   # Debería mostrar: "redis": {"status": "ok"}
   ```

3. **Verificar logs detallados:**
   ```bash
   railway logs --service comparador-csa
   # Buscar: "REDIS_URL: configured" al inicio
   ```

#### Soluciones

**Problema 1: Variable no está llegando al servicio**
- Railway Dashboard → Servicio → Variables
- Verificar que `REDIS_URL` existe y tiene el valor correcto
- Hacer click en "Deploy" para aplicar cambios

**Problema 2: Redis está en otro proyecto**
- Verificar que el servicio Redis está en el mismo proyecto Railway (`miraculous-blessing`)
- Si está en otro proyecto, usa la URL pública:
  ```
  redis://default:YymaPFEKzRuNdHsyCnElykqZXmuaCkHC@kodama.proxy.rlwy.net:42389
  ```

**Problema 3: Network interna no funciona**
- Probar con URL pública temporalmente
- Contactar soporte de Railway si persiste

**Problema 4: Redis no está corriendo**
- Railway Dashboard → Servicio Redis
- Verificar que está "Running" (no "Crashed" o "Stopped")
- Reiniciar el servicio Redis si es necesario

#### Script de diagnóstico

```bash
# Descargar y ejecutar diagnóstico
npx ts-node server/src/scripts/diagnose-redis.ts
```

**Nota:** Sin Redis configurado, el sistema automáticamente usa cache en memoria como fallback. El análisis funciona correctamente sin Redis, solo con menos rendimiento.

---

## Feature Flags

### `VITE_ENABLE_ADVANCED_ANALYSIS`

Controla la visibilidad de las capacidades de análisis avanzado:

- **`false`** (default): Solo muestra análisis básico (backward compatible)
- **`true`**: Activa pestaña "Análisis Avanzado" con:
  - Validación de coberturas contra clausulados
  - Análisis de riesgo de deducibles
  - Riesgos contextualizados por perfil de cliente
  - Cumplimiento de garantías
  - Opiniones legales con puntos de negociación

**Configuración:** Variable en Railway Dashboard (se aplica en build time).

### Rollout Gradual Recomendado

1. **Deploy con flag = false** (seguro, sin cambios visibles)
2. **Staging:** Cambiar a `true` para testing interno
3. **Producción 10%:** Activar para usuarios beta
4. **Producción 50%:** Si no hay errores en 48h
5. **Producción 100%:** Después de 1 semana estable

## Rollback

### Rollback Rápido (Feature Flag)

Si el análisis avanzado causa problemas:

1. **Railway Dashboard → Variables**
2. **Cambiar `VITE_ENABLE_ADVANCED_ANALYSIS` = `false`**
3. **Redeploy** (Railway reconstruye automáticamente)
4. **Efecto inmediato**: La UI vuelve al modo básico sin afectar el backend

### Rollback Completo (Deployment)

Si el deploy falla:

1. **Opción rápida:** En Railway Dashboard → Deployments → Seleccionar deployment anterior → Redeploy
2. **Opción Git:** Revertir el commit en GitHub, Railway hará deploy automático del estado anterior

---

## Fix de Indexación Dual de Clausulados

### Problema

Los clausulados subidos se indexaban en `documents` + `chunks` pero NO en `clause_chunks` + `clause_coverages`. Esto causaba que:
- El análisis avanzado no encontrara datos
- El chatbot respondiera "no tengo suficiente información"
- Los servicios RAG no tuvieran contexto de clausulados

### Solución Implementada

1. **Modificación del flujo de upload** (`documentController.ts`):
   - Después de indexar en `documents`, detecta si es `CLAUSULADO_GENERAL` o `CLAUSULADO_PARTICULAR`
   - Ejecuta automáticamente `clauseIndexer.startIndexing()` con el `documentId` existente
   - Los errores en clauseIndexer se loguean pero NO afectan la respuesta al usuario

2. **Compatibilidad de embeddings** (`clauseIndexer.ts`):
   - `DocumentIndexingService` genera embeddings de 3072 dims (Gemini)
   - `clause_chunks` usa 768 dims (límite HNSW)
   - **Solución**: Truncar embeddings a 768 dims antes de insertar en `clause_chunks`

3. **Corrección de referencias** (`auditEnrichmentService.ts`):
   - Cambiada referencia a tabla inexistente `clause_documents` → `documents`
   - Corregido error PGRST205

4. **Script de re-indexación** (`scripts/reindex-clauses.ts`):
   - Re-indexa clausulados existentes (SBS, HDI) sin re-upload
   - Descarga PDFs desde Supabase Storage y ejecuta clauseIndexer

### Verificación Post-Deploy

```bash
# Verificar que clause_chunks tiene datos
SELECT COUNT(*) FROM clause_chunks;

# Verificar función RPC
SELECT * FROM match_clauses(
    ARRAY(SELECT random() FROM generate_series(1, 768))::vector,
    'responsabilidad civil', NULL, NULL, NULL, 5
);
```

### Logs a Monitorear

Buscar en Railway Dashboard:
- `✅ [documentController] Clause indexing job started:` - Indexación dual exitosa
- `⚠️ [documentController] Clause indexing failed` - Errores (no críticos)
- `✅ [clauseIndexer] Job completed:` - Indexación completada

---

## Schema de Base de Datos

### Vista `document_insurer_view`

Vista que une `documents` con `insurers` para exponer `insurer_name` sin modificar la tabla original.

**Propósito:**
- Permite a los servicios de análisis avanzado obtener el nombre de la aseguradora
- No requiere modificar la tabla `documents` (backward compatible)
- Se actualiza automáticamente cuando cambian los datos subyacentes

**SQL:**
```sql
CREATE OR REPLACE VIEW document_insurer_view AS
SELECT d.*, i.name as insurer_name
FROM documents d
JOIN insurers i ON d.insurer_id = i.id;
```

**Uso en el código:**
```typescript
// En vez de:
// SELECT * FROM documents WHERE insurer_name = 'Bolívar'

// Usar:
// SELECT * FROM document_insurer_view WHERE insurer_name = 'Bolívar'
```

### Tabla `clause_chunks`

Almacena chunks vectorizados de clausulados para búsqueda semántica (RAG).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid | Primary key |
| `document_id` | uuid | FK a documents |
| `content` | text | Texto del chunk |
| `embedding` | vector(768) | Embedding del chunk |
| `metadata` | jsonb | Metadatos adicionales |
| `created_at` | timestamp | Fecha de creación |

**Funciones:**
- `match_clauses(query_embedding, match_threshold, match_count)` - Búsqueda semántica
- `match_documents(query_embedding, match_threshold, match_count)` - Búsqueda en documentos

**Seed inicial:** Ejecutar `npm run seed:clauses` para cargar clausulados base.

## Monitoreo

- **Logs:** Railway Dashboard → Logs
- **Health:** `https://tu-app.railway.app/health`
- **Métricas:** Railway Dashboard → Metrics

---

## Notas Importantes

- El primer build puede tardar 3-5 minutos (descarga de dependencias)
- Builds subsiguientes son más rápidos gracias a Docker layer caching
- No incluyas archivos `.env` en Git (están en `.gitignore` y `.dockerignore`)
- Los archivos compilados (`dist/`, `server/dist/`) NO deben estar en Git
