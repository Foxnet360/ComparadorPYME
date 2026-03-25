-- Migration: Create analysis_history table for Supabase
-- Replaces Firestore functionality
-- Schema matches existing TypeScript definition

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create analysis_history table
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    client_name TEXT NOT NULL,
    quote_document_ids TEXT[],
    clause_document_ids TEXT[],
    analysis_result JSONB NOT NULL,
    recommendation TEXT,
    total_score NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_created ON analysis_history(user_id, created_at DESC);

-- Add table comment
COMMENT ON TABLE analysis_history IS 'Stores analysis results for user history - migrated from Firestore';

-- Enable Row Level Security (RLS)
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own history
CREATE POLICY "Users can view own analysis history" 
    ON analysis_history FOR SELECT 
    USING (user_id = current_setting('app.current_user_id', true));

-- Create policy for users to insert their own history
CREATE POLICY "Users can insert own analysis history" 
    ON analysis_history FOR INSERT 
    WITH CHECK (user_id = current_setting('app.current_user_id', true));
