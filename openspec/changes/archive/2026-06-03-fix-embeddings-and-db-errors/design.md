## Context

El Comparador CSA experimenta fallos críticos en el RAG semántico y el validador de clausulados. Estos fallos provienen de consultas a campos inexistentes en las tablas físicas, incompatibilidad de dimensiones vectoriales (pgvector configurado en 768 dimensiones frente al backend solicitando 3072), y un modelo de embeddings hardcodeado en la base de datos de la caché (`gemini-embedding-001`).

## Goals / Non-Goals

**Goals:**
* Sincronizar backend y base de datos Supabase en 3072 dimensiones.
* Corregir consultas SQL para utilizar la vista `document_insurer_view` cuando se requiera consultar por nombre de aseguradora.
* Dinamizar el servicio de caché de embeddings con el modelo de entorno activo.
* Implementar migraciones SQL para redimensionar y recrear los índices vectoriales.

**Non-Goals:**
* Modificar el flujo de scraping de PDF o el diseño visual del front-end.
* Alterar los algoritmos de recomendación narrativa.

## Decisions

### Decisión 1: Consultar la Vista `document_insurer_view` en el Backend
* **Rationale:** La tabla `documents` no posee la columna `insurer_name` directamente, solo `insurer_id`. La vista `document_insurer_view` une ambas tablas adecuadamente y expone `insurer_name`.
* **Alternativas:** Reescribir consultas complejas con Joins dinámicos desde Supabase-JS. Se descartó por redundancia, ya que la vista ya existe y está pensada para esto.

### Decisión 2: Homogeneizar Dimensiones a 3072
* **Rationale:** `gemini-embedding-2` es el modelo recomendado por su alta precisión y opera a 3072 dimensiones de forma nativa.
* **Alternativas:** Truncar los embeddings a 768 dimensiones. Se descartó debido a que reduce la fidelidad semántica en clausulados legales complejos.

### Decisión 3: Caché Dinámica
* **Rationale:** Cambiar el literal hardcodeado `'gemini-embedding-001'` en `embeddingCacheService.ts` por `env.GEMINI_EMBEDDING_MODEL`.

## Risks / Trade-offs

* **[Risk]** Error de migración en Supabase si existen registros previos con vectores de 768 dimensiones.
  * **Mitigación:** La migración SQL aplicará `ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072)` y limpiará/recreará los índices vectoriales correspondientes.
