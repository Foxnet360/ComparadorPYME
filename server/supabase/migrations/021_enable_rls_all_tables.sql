-- Migration 021: Enable RLS on all tables and add appropriate access policies

-- Step 1: Add new columns to client_profiles if not present
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS raw_client_data JSONB;

-- Step 2: Enable Row-Level Security on all 14 tables

ALTER TABLE public.insurers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_coverages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clause_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contextual_risk_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_embeddings_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structured_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coverage_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductible_benchmarks ENABLE ROW LEVEL SECURITY;

-- Step 3: Create policies for general read-only/reference tables (allow all authenticated/anon read)

CREATE POLICY "Allow select for insurers" ON public.insurers FOR SELECT USING (true);
CREATE POLICY "Allow select for documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow select for page_images" ON public.page_images FOR SELECT USING (true);
CREATE POLICY "Allow select for chunks" ON public.chunks FOR SELECT USING (true);
CREATE POLICY "Allow select for clause_coverages" ON public.clause_coverages FOR SELECT USING (true);
CREATE POLICY "Allow select for clause_versions" ON public.clause_versions FOR SELECT USING (true);
CREATE POLICY "Allow select for coverage_embeddings_cache" ON public.coverage_embeddings_cache FOR SELECT USING (true);
CREATE POLICY "Allow select for structured_clauses" ON public.structured_clauses FOR SELECT USING (true);
CREATE POLICY "Allow select for coverage_mappings" ON public.coverage_mappings FOR SELECT USING (true);
CREATE POLICY "Allow select for deductible_benchmarks" ON public.deductible_benchmarks FOR SELECT USING (true);

-- Step 4: Create policies for user-specific tables

-- 4a. client_profiles (owner read/write)
CREATE POLICY "Users can select own client profiles" ON public.client_profiles 
  FOR SELECT USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own client profiles" ON public.client_profiles 
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own client profiles" ON public.client_profiles 
  FOR UPDATE USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own client profiles" ON public.client_profiles 
  FOR DELETE USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

-- 4b. chat_threads (owner read/write)
CREATE POLICY "Users can select own chat threads" ON public.chat_threads 
  FOR SELECT USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert own chat threads" ON public.chat_threads 
  FOR INSERT WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update own chat threads" ON public.chat_threads 
  FOR UPDATE USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true))
  WITH CHECK (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete own chat threads" ON public.chat_threads 
  FOR DELETE USING (user_id = auth.uid()::text OR user_id = current_setting('app.current_user_id', true));

-- 4c. chat_messages (thread owner read/write)
CREATE POLICY "Users can select own chat messages" ON public.chat_messages 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND (chat_threads.user_id = auth.uid()::text OR chat_threads.user_id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "Users can insert own chat messages" ON public.chat_messages 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads 
      WHERE chat_threads.id = thread_id 
      AND (chat_threads.user_id = auth.uid()::text OR chat_threads.user_id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "Users can update own chat messages" ON public.chat_messages 
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND (chat_threads.user_id = auth.uid()::text OR chat_threads.user_id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "Users can delete own chat messages" ON public.chat_messages 
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads 
      WHERE chat_threads.id = chat_messages.thread_id 
      AND (chat_threads.user_id = auth.uid()::text OR chat_threads.user_id = current_setting('app.current_user_id', true))
    )
  );

-- 4d. contextual_risk_analysis (analysis owner read/write)
CREATE POLICY "Users can select own contextual risk analysis" ON public.contextual_risk_analysis 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE analysis_history.id = contextual_risk_analysis.analysis_history_id 
      AND (analysis_history.user_id = auth.uid()::text OR analysis_history.user_id = current_setting('app.current_user_id', true))
    )
  );

CREATE POLICY "Users can insert own contextual risk analysis" ON public.contextual_risk_analysis 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_history 
      WHERE analysis_history.id = analysis_history_id 
      AND (analysis_history.user_id = auth.uid()::text OR analysis_history.user_id = current_setting('app.current_user_id', true))
    )
  );
