## 1. Ajustes de Configuración y Base de Datos (Supabase)

- [x] 1.1 Homogeneizar variables de entorno de modelos en los archivos `.env` (raíz y /server) para usar `gemini-3.5-flash` y `gemini-embedding-2`.
- [x] 1.2 Crear y ejecutar la migración SQL `017_align_embeddings_3072.sql` para alterar la columna `embedding` de `chunks` a `vector(3072)` y recrear sus índices vectoriales. (Nota: Ya está en 3072 dimensiones).

## 2. Implementación de Servicios en el Backend

- [x] 2.1 Actualizar `embeddingService.ts` para que `EMBEDDING_DIMENSIONS` sea 3072 de forma predeterminada y use `gemini-embedding-2` de forma consistente. (Nota: Ya está implementado).
- [x] 2.2 Modificar `embeddingCacheService.ts` para que use dinámicamente la variable `env.GEMINI_EMBEDDING_MODEL` en las consultas de base de datos en lugar de la cadena hardcodeada `'gemini-embedding-001'`.
- [x] 2.3 Modificar la función `checkClauseDocumentExists` en `clauseCoverageValidator.ts` para realizar la búsqueda sobre la vista `document_insurer_view` en lugar de la tabla física `documents`.
- [x] 2.4 Modificar `getDocumentsByInsurer` en `documentRepository.ts` para consultar desde `document_insurer_view` en lugar de `documents`.

## 3. Pruebas y Validación

- [x] 3.1 Ejecutar pruebas unitarias de validación de cobertura (`clauseCoverageValidator.test.ts`).
- [x] 3.2 Probar el flujo de carga e indexación de un clausulado en el Comparador y verificar en logs que los embeddings de 3072 dimensiones se indexan sin error. (Nota: Se probó el RAG end-to-end con embeddings de 3072 dimensiones exitosamente).
