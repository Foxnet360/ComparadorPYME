-- 003_storage_policies.sql
-- Configuración de Storage y políticas de acceso

-- Crear bucket para imágenes de páginas (si no existe)
-- Nota: Esto debe ejecutarse desde la consola de Supabase o usando la API
-- ya que no se puede crear buckets directamente desde SQL

/*
Instrucciones para crear el bucket desde el Dashboard:
1. Ve a Storage en el menú lateral
2. Haz clic en "New Bucket"
3. Nombre: clause-pages
4. Desmarca "Public bucket" (será privado)
5. Crea el bucket
6. Ve a Policies y crea las siguientes:

Política 1: Permitir lectura pública de imágenes
- Name: Allow public read
- Allowed operation: SELECT
- Target roles: anon, authenticated
- Policy definition: bucket_id = 'clause-pages'

Política 2: Permitir escritura solo al service_role
- Name: Allow service uploads
- Allowed operation: INSERT
- Target roles: service_role
- Policy definition: bucket_id = 'clause-pages'

Política 3: Permitir eliminación solo al service_role
- Name: Allow service deletes
- Allowed operation: DELETE
- Target roles: service_role
- Policy definition: bucket_id = 'clause-pages'
*/

-- Estructura esperada del bucket:
-- clause-pages/
--   └── {insurer-id}/
--       └── {document-id}/
--           ├── page-1.png
--           ├── page-2.png
--           └── ...

-- Tabla auxiliar para tracking de uploads (opcional, para debugging)
CREATE TABLE IF NOT EXISTS storage_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    upload_status TEXT CHECK (upload_status IN ('PENDING', 'COMPLETED', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_storage_uploads_document ON storage_uploads(document_id);
