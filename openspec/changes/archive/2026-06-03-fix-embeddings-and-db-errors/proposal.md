## Why

El Comparador CSA presenta errores de base de datos (PostgREST) y fallos en el RAG semántico debido a un desajuste de dimensiones de vectores (768 vs 3072) con `gemini-embedding-2`, referencias a columnas/tablas inexistentes (`insurer_name` en la tabla `documents` y la tabla obsoleta `clause_documents`), y un modelo de embeddings hardcodeado en la caché (`gemini-embedding-001`). Esto degrada la fiabilidad y funcionalidad de la auditoría de clausulados.

## What Changes

* **Alineación de Embeddings a 3072:** Sincronizar el backend y los esquemas de la base de datos Supabase para usar consistentemente 3072 dimensiones con `gemini-embedding-2`.
* **Caché Dinámica:** Modificar el servicio de caché de embeddings para usar dinámicamente el modelo activo en lugar de un nombre hardcodeado.
* **Corrección de Consultas de Base de Datos:**
  * Reemplazar las consultas directas de filtrado por `insurer_name` en la tabla `documents` para que se realicen sobre la vista `document_insurer_view`.
  * Corregir referencias obsoletas a tablas inexistentes en el backend.

## Capabilities

### New Capabilities
* None

### Modified Capabilities
- `vector-storage`: El requerimiento del tamaño de vector en la tabla chunks cambia de vector(768) a vector(3072) para dar soporte nativo de alta dimensionalidad a gemini-embedding-2.

## Impact

* **Backend:** Modificaciones en `embeddingService.ts`, `embeddingCacheService.ts`, `clauseCoverageValidator.ts` y `documentRepository.ts`.
* **Database:** Creación de una migración SQL para asegurar que la columna `embedding` en la tabla `chunks` use `vector(3072)`.
