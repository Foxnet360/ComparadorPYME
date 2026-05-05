# CLI Seed Script - Guía de Uso

## Descripción

El script `seedClauses.ts` permite cargar masivamente clausulados PDF en la librería persistente. Es ideal para:

- Migración inicial de clausulados (ej: 24 aseguradoras)
- Carga batch periódica de nuevos documentos
- Recuperación ante desastres (re-indexación desde backups)

## Requisitos Previos

- Node.js v18+
- Variables de entorno configuradas (`.env`):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Archivos PDF en directorio `/Ejemplos/` o path personalizado

## Instalación

El script ya está instalado en:
```
server/src/scripts/seedClauses.ts
```

Y registrado en `package.json`:
```json
{
  "scripts": {
    "seed:clauses": "cd server && ts-node --transpile-only src/scripts/seedClauses.ts"
  }
}
```

## Modos de Operación

### 1. Modo Interactivo (Recomendado para primera vez)

```bash
npm run seed:clauses
```

**Flujo:**
1. Escanea recursivamente `/Ejemplos/` buscando PDFs
2. Por cada archivo:
   - Muestra nombre, tamaño, hash
   - Detecta aseguradora automáticamente desde el nombre
   - Pregunta confirmación de metadatos
   - Pregunta producto, versión, tipo
   - Pide confirmación antes de indexar
3. Guarda estado en `server/seed-state.json`

**Ejemplo de sesión interactiva:**
```
[1/7]
📄 Clausulado - AXA Colpatria.pdf
   Ruta: laser-home/Clausulados/Clausulado - AXA Colpatria.pdf
   Tamaño: 245.3 KB
   Hash: a3f7b2d1...
   
   Aseguradora detectada: "AXA Colpatria" ¿Correcto? (s/n): s
   Nombre del producto (ej: Póliza PYME): Póliza PYME
   Versión (ej: 2024.1) [opcional]: 2024.1
   Tipo (1=General, 2=Particular, 3=Anexo): 1
   Nombre del documento [Clausulado - AXA Colpatria]: 
   ¿Proceder con indexación? (s/n): s
   
🚀 Indexando: Clausulado - AXA Colpatria.pdf
   Aseguradora: AXA Colpatria
   Producto: Póliza PYME
   Tipo: CLAUSULADO_GENERAL
   Versión: 2024.1
   ✅ Éxito! Document ID: 550e8400-e29b-41d4-a716-446655440000
      Páginas: 45
      Chunks: 127
      Tiempo: 8500ms
```

### 2. Modo Batch con Manifest

Para ejecuciones repetibles sin interacción:

**Paso 1: Generar manifest de ejemplo**
```bash
npm run seed:clauses -- --generate-manifest
```

Esto crea `server/manifest-example.json`:
```json
{
  "entries": [
    {
      "filePath": "/home/.../Ejemplos/laser-home/Clausulados/Clausulado - AXA Colpatria.pdf",
      "insurerName": "AXA Colpatria",
      "documentName": "Clausulado - AXA Colpatria",
      "documentType": "CLAUSULADO_GENERAL",
      "productName": "General",
      "version": "2024.1"
    }
  ]
}
```

**Paso 2: Editar manifest**

Copiar y editar el manifest con los metadatos correctos:
```bash
cp server/manifest-example.json server/manifest-production.json
# Editar con tu editor favorito
```

**Campos del manifest:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `filePath` | string | Sí | Ruta absoluta al PDF |
| `insurerName` | string | Sí | Nombre de la aseguradora |
| `documentName` | string | Sí | Nombre descriptivo del documento |
| `documentType` | string | Sí | `CLAUSULADO_GENERAL`, `CLAUSULADO_PARTICULAR`, `ANEXO` |
| `productName` | string | Sí | Nombre del producto/ramo |
| `version` | string | No | Identificador de versión |

**Paso 3: Ejecutar batch**
```bash
npm run seed:clauses -- --manifest=server/manifest-production.json
```

### 3. Modo Resumir (Resume)

Si el proceso se interrumpe, usa `--resume` para saltar archivos ya procesados:

```bash
npm run seed:clauses -- --manifest=manifest.json --resume
```

El sistema detecta duplicados por **hash MD5 del archivo** y mantiene el estado en `server/seed-state.json`.

## Opciones de Línea de Comandos

| Opción | Descripción |
|--------|-------------|
| `--manifest=<file>` | Usar manifest JSON para modo batch |
| `--resume` | Saltar archivos ya procesados (requiere `--manifest`) |
| `--generate-manifest` | Generar manifest de ejemplo y salir |

## Detección Automática

### Nombres de Aseguradora

El script intenta detectar la aseguradora desde el nombre del archivo:

```
"Clausulado - AXA Colpatria.pdf" → "AXA Colpatria"
"CLAUSULADO HDI.pdf" → "HDI"
"Cotización - BBVA.pdf" → "BBVA"
```

**Patrones soportados:**
- `Clausulado - [NOMBRE]`
- `CLAUSULADO [NOMBRE]`
- `Cotización - [NOMBRE]`
- `COTIZACION [NOMBRE]`

### Tipos de Documento

Detecta tipo desde la ruta del directorio:

| Directorio | Tipo Detectado |
|------------|----------------|
| `Clausulados/` | `CLAUSULADO_GENERAL` |
| `Cotizaciones/` | `CLAUSULADO_PARTICULAR` |
| `Anexos/` | `ANEXO` |

## Estado y Seguimiento

### Archivo de Estado

`server/seed-state.json`:
```json
{
  "completed": ["a3f7b2d1...", "c8e9d4f2..."],
  "failed": [
    {
      "file": "/path/to/file.pdf",
      "error": "Error message"
    }
  ],
  "lastRun": "2026-05-05T17:30:00.000Z"
}
```

### Hash de Archivos

Los archivos se identifican por **hash MD5 del contenido** (no del nombre). Esto permite:
- Detectar duplicados reales
- Renombrar archivos sin perder seguimiento
- Evitar re-indexar archivos idénticos

## Resumen de Ejecución

Al finalizar, el script muestra:

```
📊 Resumen:
   Procesados: 6
   Saltados: 1
   Fallidos: 0
   Total: 7
```

## Solución de Problemas

### Error: "Supabase configuration incomplete"

**Causa**: Faltan variables de entorno

**Solución**:
```bash
# Verificar .env en server/
cat server/.env
# Debe contener:
# SUPABASE_URL=https://...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Error: "No se encontraron archivos PDF"

**Causa**: Directorio `/Ejemplos/` vacío o no existe

**Solución**:
```bash
# Verificar estructura
ls -la Ejemplos/
# Crear directorio si no existe
mkdir -p Ejemplos/
```

### Archivo marcado como "Ya procesado" pero no está en DB

**Causa**: Estado local desincronizado con DB

**Solución**:
```bash
# Limpiar estado local
rm server/seed-state.json
# Re-ejecutar
npm run seed:clauses
```

### Error en indexación de archivo específico

**Causas comunes**:
- PDF protegido con contraseña
- PDF corrupto
- PDF escaneado sin texto (OCR fallido)
- Timeout de API de embeddings

**Solución**:
1. Verificar PDF puede abrirse normalmente
2. Intentar con otro PDF de prueba
3. Revisar logs del servidor para detalles del error

## Ejemplos Completos

### Cargar 7 clausulados de ejemplo

```bash
# Modo interactivo (recomendado primera vez)
npm run seed:clauses

# O en batch (si ya tienes manifest editado)
npm run seed:clauses -- --manifest=server/manifest-example.json
```

### Cargar solo clausulados (excluir cotizaciones)

Editar manifest y remover entradas de `COTIZACIONES/`:
```bash
# Generar manifest completo
npm run seed:clauses -- --generate-manifest

# Editar manualmente: eliminar entradas con documentType: "CLAUSULADO_PARTICULAR"
# Luego ejecutar
npm run seed:clauses -- --manifest=server/manifest-filtered.json
```

### Re-ejecutar después de actualizar archivos

```bash
# Limpiar estado para forzar re-procesamiento
rm server/seed-state.json

# Ejecutar nuevamente
npm run seed:clauses -- --manifest=manifest.json
```

## Rendimiento

| Factor | Tiempo Aproximado |
|--------|-------------------|
| Por archivo (10 páginas) | 5-10 segundos |
| Por archivo (50 páginas) | 15-30 segundos |
| Por archivo (100+ páginas) | 30-60 segundos |
| Total 24 aseguradoras | 15-30 minutos |

*Depende de velocidad de red y API de embeddings*

## Seguridad

- El script usa `SUPABASE_SERVICE_ROLE_KEY` (acceso administrativo)
- No compartir el manifest con rutas locales en repositorios públicos
- Los hashes MD5 son solo para deduplicación local (no seguros criptográficamente)