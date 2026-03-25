# Setup de Supabase para Agente Comparador PYME

## Prerrequisitos

1. **Service Role Key** de Supabase
   - Ve a: https://supabase.com/dashboard/project/nubiecwypgfekhvaffxm/settings/api
   - Sección: **Project API keys**
   - Copia el key de `service_role` (¡NO uses el `anon` key!)

2. **Variables de Entorno**
   ```bash
   # Copia el archivo de ejemplo
   cp .env.example .env
   
   # Edita .env y agrega:
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   GEMINI_API_KEY=tu_gemini_api_key_aqui
   ```

3. **Crear Bucket en Supabase Dashboard**
   
   Por ahora, los buckets deben crearse manualmente en el dashboard:
   
   1. Ve a: https://supabase.com/dashboard/project/nubiecwypgfekhvaffxm/storage/buckets
   2. Click **New Bucket**
   3. Nombre: `clause-pages`
   4. Desmarca "Public bucket" (lo haremos público para lectura con políticas)
   5. Click **Create bucket**
   6. Ve a la pestaña **Policies**
   7. Crea estas políticas:

   **Política 1: Lectura pública**
   - Name: `Allow public read`
   - Allowed operation: SELECT
   - Target roles: anon, authenticated
   - Policy definition: `bucket_id = 'clause-pages'`

   **Política 2: Escritura service_role**
   - Name: `Allow service uploads`
   - Allowed operation: INSERT
   - Target roles: service_role
   - Policy definition: `bucket_id = 'clause-pages'`

   **Política 3: Eliminación service_role**
   - Name: `Allow service deletes`
   - Allowed operation: DELETE
   - Target roles: service_role
   - Policy definition: `bucket_id = 'clause-pages'`

## Ejecutar Migraciones SQL

### Opción A: SQL Editor (Recomendado)

1. Ve a: https://supabase.com/dashboard/project/nubiecwypgfekhvaffxm/sql/new
2. Copia el contenido de `supabase/migrations/001_initial_schema.sql`
3. Pega en el editor y ejecuta
4. Repite para `002_vector_functions.sql`

### Opción B: Usando Script (Experimental)

```bash
npx ts-node src/scripts/setupSupabase.ts
```

## Verificar Instalación

```bash
npx ts-node src/scripts/verifySupabase.ts
```

Deberías ver:
```
🔍 Verificando conexión a Supabase...

1️⃣  Conexión a base de datos...
   ✅ Conexión exitosa

2️⃣  Extensión pgvector...
   ✅ Funciones vectoriales listas

3️⃣  Storage (clause-pages)...
   ✅ Bucket listo

4️⃣  API de Gemini Embeddings...
   ✅ Embeddings funcionando (dimensión: 768)

5️⃣  Tesauro...
   ✅ Tesauro cargado (14 coberturas)
   📚 Ejemplo: Incendio (Edificio y Contenidos), Lucro Cesante, Sustracción / Hurto...

✅ Todas las verificaciones pasaron!
```

## Estructura de Storage

Los archivos se organizan así:

```
clause-pages/
└── {insurer-id}/
    └── {document-id}/
        ├── page-1.png
        ├── page-2.png
        ├── page-3.png
        └── ...
```

## Esquema de Base de Datos

### Tablas Principales

1. **insurers** - Aseguradoras
2. **documents** - Documentos PDF indexados
3. **page_images** - Imágenes de páginas renderizadas
4. **chunks** - Fragmentos de texto con embeddings
5. **analysis_history** - Historial de análisis

### Funciones SQL

- `search_chunks_by_coverage()` - Búsqueda semántica por cobertura
- `search_chunks_advanced()` - Búsqueda con filtros múltiples
- `validate_quote_coverage()` - Validar cotización vs clausulado
- `get_chunks_with_images()` - Obtener chunks con URLs de imágenes
- `delete_document_complete()` - Eliminación en cascada

## Troubleshooting

### Error: "Bucket not found"
Asegúrate de haber creado el bucket `clause-pages` en el dashboard.

### Error: "Permission denied"
Verifica que estás usando el `SUPABASE_SERVICE_ROLE_KEY` (no el anon).

### Error: "Extension vector not found"
Ve a: Database → Extensions → busca "vector" y habilítalo.

### Error: "Invalid embedding dimension"
Asegúrate de usar `text-embedding-004` que genera vectores de 768 dimensiones.

## Siguientes Pasos

1. ✅ Setup completado
2. 🔄 Crear servicios de indexación de documentos
3. 🔄 Implementar recuperación semántica
4. 🔄 Agregar parser de deducibles
5. 🔄 Implementar motor de auditoría
