-- 015b_chat_system_add_columns.sql
-- Agrega columnas faltantes a las tablas de chat existentes

-- Agregar columnas a chat_threads
ALTER TABLE chat_threads 
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS insurer_names TEXT[],
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS context_summary TEXT;

-- Agregar columnas a chat_messages
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS sources_used JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS tokens_input INTEGER,
ADD COLUMN IF NOT EXISTS tokens_output INTEGER,
ADD COLUMN IF NOT EXISTS latency_ms INTEGER;

-- Actualizar check constraint de role para incluir 'system'
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_role_check 
CHECK (role = ANY (ARRAY['user'::text, 'model'::text, 'system'::text]));

-- Agregar índices adicionales
CREATE INDEX IF NOT EXISTS idx_chat_threads_status ON chat_threads(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
