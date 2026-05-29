-- 015_chat_system.sql
-- Migración: Sistema de Chat con persistencia en base de datos
-- Crea tablas para hilos de conversación y mensajes

-- Tabla: Hilos de Conversación (por análisis)
CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    report_id TEXT,                    -- ID del análisis/cotización
    client_name TEXT,                  -- Nombre del cliente
    insurer_names TEXT[],              -- Aseguradoras en el análisis
    title TEXT DEFAULT 'Nueva conversación',
    status TEXT DEFAULT 'active',      -- active, archived, deleted
    context_summary TEXT,              -- Resumen del contexto para prompts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla: Mensajes del Chat
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'model', 'system')),
    content TEXT NOT NULL,
    sources_used JSONB DEFAULT '[]',   -- Fuentes consultadas [{type, insurer, relevance}]
    citations JSONB DEFAULT '[]',      -- Citas específicas
    model_used TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_chat_threads_user ON chat_threads(user_id);
CREATE INDEX idx_chat_threads_report ON chat_threads(report_id) WHERE report_id IS NOT NULL;
CREATE INDEX idx_chat_threads_status ON chat_threads(status) WHERE status = 'active';
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- Trigger updated_at
CREATE TRIGGER update_chat_threads_updated_at
    BEFORE UPDATE ON chat_threads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE chat_threads IS 'Hilos de conversación del chat, uno por análisis';
COMMENT ON TABLE chat_messages IS 'Mensajes individuales del chat con metadatos';
