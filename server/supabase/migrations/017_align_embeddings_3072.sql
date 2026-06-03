-- 017_align_embeddings_3072.sql
-- Asegurar que la columna embedding en la tabla chunks tenga 3072 dimensiones

DO $$
BEGIN
    -- 1. Eliminar índice vectorial si existe
    DROP INDEX IF EXISTS idx_chunks_embedding;

    -- 2. Alterar el tipo de la columna a vector(3072)
    ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(3072);

    -- 3. Recrear el índice vectorial ivfflat para 3072 dimensiones
    CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

    -- 4. Recrear funciones asociadas si es necesario (ya creadas en migración 004 / 012)
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error al alterar la columna o índice: %', SQLERRM;
END $$;
