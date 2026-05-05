-- 1. Agregar columna product_name
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS product_name TEXT;
-- 2. Actualizar constraint de document_type (incluir ANEXO)
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents 
ADD CONSTRAINT documents_document_type_check 
CHECK (document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'COTIZACION', 'ANEXO'));
-- 3. Crear unique index parcial (FORMA CORRECTA)
-- Nota: Usamos COALESCE para manejar product_name NULL
DROP INDEX IF EXISTS documents_unique_active_version;
CREATE UNIQUE INDEX documents_unique_active_version 
ON documents(insurer_id, document_type, COALESCE(product_name, '')) 
WHERE is_active = true;
-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_documents_product ON documents(product_name);
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(insurer_id, document_type, product_name, is_active);
-- 5. Comentario
COMMENT ON COLUMN documents.product_name IS 'Nombre del producto/ramo al que pertenece el clausulado (ej: Póliza PYME, Seguro Empresarial)';