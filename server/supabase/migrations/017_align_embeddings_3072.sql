-- 017_align_embeddings_3072.sql
-- Asegurar que la columna embedding en la tabla chunks tenga 3072 dimensiones

DO $$
BEGIN
    -- 1. Eliminar índice vectorial previo si existe (para 3072D se utiliza escaneo secuencial o HNSW/halfvec cuando sea compatible)
    DROP INDEX IF EXISTS idx_chunks_embedding;

    -- 2. Alterar el tipo de la columna a vector(3072)
    ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072);

    -- Nota: pgvector ivfflat tiene un límite estricto de 2000 dimensiones.
    -- Las búsquedas vectoriales sobre 3072D utilizan exact distance scans sin necesidad de ivfflat.
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al alterar la columna o índice: %', SQLERRM;
END $$;
