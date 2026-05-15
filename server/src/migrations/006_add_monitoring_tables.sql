-- Migration: Add monitoring tables for post-deployment tracking
-- Created: 2026-01-15

-- Table for accuracy logs
CREATE TABLE IF NOT EXISTS accuracy_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- 'extraction', 'deductible_parsing', 'ontology_mapping', 'chat_response'
    coverage_name VARCHAR(255),
    raw_text TEXT,
    extracted_value TEXT,
    correct_value TEXT,
    parsed_result JSONB,
    is_correct BOOLEAN NOT NULL,
    error_type VARCHAR(100),
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for accuracy logs
CREATE INDEX IF NOT EXISTS idx_accuracy_logs_type ON accuracy_logs(type);
CREATE INDEX IF NOT EXISTS idx_accuracy_logs_timestamp ON accuracy_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_accuracy_logs_is_correct ON accuracy_logs(is_correct);

-- Table for chat quality logs
CREATE TABLE IF NOT EXISTS chat_quality_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'rag', 'ontology', 'fallback', 'direct'
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    was_helpful BOOLEAN,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for chat quality logs
CREATE INDEX IF NOT EXISTS idx_chat_quality_logs_source ON chat_quality_logs(source);
CREATE INDEX IF NOT EXISTS idx_chat_quality_logs_timestamp ON chat_quality_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_quality_logs_rating ON chat_quality_logs(user_rating);

-- Table for user feedback
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feature VARCHAR(100) NOT NULL, -- 'semantic_ontology', 'variable_comparison', 'triple_source_chat', etc.
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    user_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user feedback
CREATE INDEX IF NOT EXISTS idx_user_feedback_feature ON user_feedback(feature);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);

-- Table for performance logs
CREATE TABLE IF NOT EXISTS performance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operation VARCHAR(100) NOT NULL, -- 'analysis', 'chat_response', 'clause_extraction', etc.
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance logs
CREATE INDEX IF NOT EXISTS idx_performance_logs_operation ON performance_logs(operation);
CREATE INDEX IF NOT EXISTS idx_performance_logs_timestamp ON performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_logs_success ON performance_logs(success);

-- Enable RLS on monitoring tables
ALTER TABLE accuracy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_quality_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow authenticated read access" ON accuracy_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON chat_quality_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON user_feedback
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON performance_logs
    FOR SELECT TO authenticated USING (true);

-- Insert comment for documentation
COMMENT ON TABLE accuracy_logs IS 'Tracks accuracy of extraction and parsing operations';
COMMENT ON TABLE chat_quality_logs IS 'Tracks quality of chat responses';
COMMENT ON TABLE user_feedback IS 'Stores user feedback on new features';
COMMENT ON TABLE performance_logs IS 'Tracks performance metrics for operations';