-- Function to insert document, page images, and chunks in a single atomic transaction
-- Updated to support product_name for multi-clause versioning
CREATE OR REPLACE FUNCTION index_document_transaction(
    p_insurer_id UUID,
    p_document_name TEXT,
    p_document_type TEXT,
    p_version TEXT,
    p_total_pages INTEGER,
    p_storage_path TEXT,
    p_uploaded_by TEXT,
    p_images JSONB,
    p_chunks JSONB,
    p_product_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_document_id UUID;
    v_image JSONB;
    v_chunk JSONB;
BEGIN
    -- 1. Insert Document
    INSERT INTO documents (
        insurer_id,
        document_name,
        document_type,
        version,
        product_name,
        total_pages,
        storage_path,
        is_active,
        uploaded_by
    ) VALUES (
        p_insurer_id,
        p_document_name,
        p_document_type,
        p_version,
        COALESCE(p_product_name, p_document_name),
        p_total_pages,
        p_storage_path,
        true,
        p_uploaded_by
    ) RETURNING id INTO v_document_id;

    -- 2. Insert Page Images
    IF p_images IS NOT NULL AND jsonb_array_length(p_images) > 0 THEN
        INSERT INTO page_images (
            document_id,
            page_number,
            storage_url,
            storage_path,
            width,
            height
        )
        SELECT
            v_document_id,
            (image->>'page_number')::INTEGER,
            image->>'storage_url',
            image->>'storage_path',
            (image->>'width')::INTEGER,
            (image->>'height')::INTEGER
        FROM jsonb_array_elements(p_images) AS image;
    END IF;

    -- 3. Insert Chunks
    IF p_chunks IS NOT NULL AND jsonb_array_length(p_chunks) > 0 THEN
        INSERT INTO chunks (
            document_id,
            page_number,
            content,
            content_normalized,
            embedding,
            metadata,
            coverage_tags,
            section_type
        )
        SELECT
            v_document_id,
            (chunk->>'page_number')::INTEGER,
            chunk->>'content',
            chunk->>'content_normalized',
            (chunk->>'embedding')::vector,
            chunk->'metadata',
            ARRAY(SELECT jsonb_array_elements_text(chunk->'coverage_tags')),
            chunk->>'section_type'
        FROM jsonb_array_elements(p_chunks) AS chunk;
    END IF;

    -- Return the created document ID
    RETURN v_document_id;
EXCEPTION
    WHEN OTHERS THEN
        -- The transaction will automatically rollback
        RAISE EXCEPTION 'Failed to index document: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
