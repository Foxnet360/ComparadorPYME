export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      insurers: {
        Row: {
          id: string;
          name: string;
          nit: string | null;
          contact_email: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nit?: string | null;
          contact_email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          nit?: string | null;
          contact_email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          insurer_id: string;
          document_name: string;
          document_type: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION';
          product_name: string | null;
          domain: string | null;
          version: string | null;
          total_pages: number | null;
          storage_path: string;
          file_hash: string | null;
          is_active: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          insurer_id: string;
          document_name: string;
          document_type: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION';
          product_name?: string | null;
          domain?: string | null;
          version?: string | null;
          total_pages?: number | null;
          storage_path: string;
          file_hash?: string | null;
          is_active?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          insurer_id?: string;
          document_name?: string;
          document_type?: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION';
          product_name?: string | null;
          domain?: string | null;
          version?: string | null;
          total_pages?: number | null;
          storage_path?: string;
          file_hash?: string | null;
          is_active?: boolean;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      client_profiles: {
        Row: {
          id: string;
          user_id: string;
          client_name: string;
          primary_activity: string | null;
          location_city: string | null;
          raw_client_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_name: string;
          primary_activity?: string | null;
          location_city?: string | null;
          raw_client_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_name?: string;
          primary_activity?: string | null;
          location_city?: string | null;
          raw_client_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      page_images: {
        Row: {
          id: string;
          document_id: string;
          page_number: number;
          storage_url: string;
          storage_path: string;
          ocr_text: string | null;
          width: number | null;
          height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          page_number: number;
          storage_url: string;
          storage_path: string;
          ocr_text?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          page_number?: number;
          storage_url?: string;
          storage_path?: string;
          ocr_text?: string | null;
          width?: number | null;
          height?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      chunks: {
        Row: {
          id: string;
          document_id: string;
          page_number: number;
          content: string;
          content_normalized: string | null;
          embedding: string | null;
          metadata: Json;
          coverage_tags: string[] | null;
          section_type: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          page_number: number;
          content: string;
          content_normalized?: string | null;
          embedding?: string | null;
          metadata?: Json;
          coverage_tags?: string[] | null;
          section_type?: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          page_number?: number;
          content?: string;
          content_normalized?: string | null;
          embedding?: string | null;
          metadata?: Json;
          coverage_tags?: string[] | null;
          section_type?: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null;
          created_at?: string;
        };
        Relationships: [];
      };
      analysis_history: {
        Row: {
          id: string;
          user_id: string | null;
          client_name: string;
          quote_document_ids: string[] | null;
          clause_document_ids: string[] | null;
          analysis_result: Json;
          recommendation: string | null;
          total_score: number | null;
          analysis_type?: string | null;
          policy_id?: string | null;
          renewal_id?: string | null;
          engine_type?: 'legacy' | 'unified' | 'fallback' | null;
          processing_time_ms?: number | null;
          confidence_score?: number | null;
          unified_result?: Json | null;
          fallback_reason?: string | null;
          domain?: string | null;
          metadata?: Json | null;
          quotes_count?: number | null;
          total_coverages?: number | null;
          average_confidence?: number | null;
          best_insurer?: string | null;
          best_score?: number | null;
          price_range_min?: number | null;
          price_range_max?: number | null;
          extraction_confidence?: number | null;
          needs_review?: boolean | null;
          validation_flags_count?: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_name: string;
          quote_document_ids?: string[] | null;
          clause_document_ids?: string[] | null;
          analysis_result: Json;
          recommendation?: string | null;
          total_score?: number | null;
          analysis_type?: string | null;
          policy_id?: string | null;
          renewal_id?: string | null;
          engine_type?: 'legacy' | 'unified' | 'fallback' | null;
          processing_time_ms?: number | null;
          confidence_score?: number | null;
          unified_result?: Json | null;
          fallback_reason?: string | null;
          domain?: string | null;
          metadata?: Json | null;
          quotes_count?: number | null;
          total_coverages?: number | null;
          average_confidence?: number | null;
          best_insurer?: string | null;
          best_score?: number | null;
          price_range_min?: number | null;
          price_range_max?: number | null;
          extraction_confidence?: number | null;
          needs_review?: boolean | null;
          validation_flags_count?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_name?: string;
          quote_document_ids?: string[] | null;
          clause_document_ids?: string[] | null;
          analysis_result?: Json;
          recommendation?: string | null;
          total_score?: number | null;
          analysis_type?: string | null;
          policy_id?: string | null;
          renewal_id?: string | null;
          engine_type?: 'legacy' | 'unified' | 'fallback' | null;
          processing_time_ms?: number | null;
          confidence_score?: number | null;
          unified_result?: Json | null;
          fallback_reason?: string | null;
          domain?: string | null;
          metadata?: Json | null;
          quotes_count?: number | null;
          total_coverages?: number | null;
          average_confidence?: number | null;
          best_insurer?: string | null;
          best_score?: number | null;
          price_range_min?: number | null;
          price_range_max?: number | null;
          extraction_confidence?: number | null;
          needs_review?: boolean | null;
          validation_flags_count?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          name: string;
          tax_id: string | null;
          contact: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id?: string | null;
          name: string;
          tax_id?: string | null;
          contact?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          org_id?: string | null;
          name?: string;
          tax_id?: string | null;
          contact?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          client_id: string;
          ramo: string;
          insurer: string;
          policy_number: string | null;
          premium: number | null;
          start_date: string | null;
          end_date: string | null;
          coverages: Json;
          deductibles: Json;
          provenance: string;
          source_analysis_id: string | null;
          ramo_details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id?: string | null;
          client_id: string;
          ramo: string;
          insurer: string;
          policy_number?: string | null;
          premium?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          coverages?: Json;
          deductibles?: Json;
          provenance?: string;
          source_analysis_id?: string | null;
          ramo_details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          org_id?: string | null;
          client_id?: string;
          ramo?: string;
          insurer?: string;
          policy_number?: string | null;
          premium?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          coverages?: Json;
          deductibles?: Json;
          provenance?: string;
          source_analysis_id?: string | null;
          ramo_details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      renewals: {
        Row: {
          id: string;
          user_id: string;
          org_id: string | null;
          policy_id: string;
          cycle_start: string;
          state: string;
          outcome: string | null;
          final_premium: number | null;
          loss_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          org_id?: string | null;
          policy_id: string;
          cycle_start: string;
          state?: string;
          outcome?: string | null;
          final_premium?: number | null;
          loss_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          org_id?: string | null;
          policy_id?: string;
          cycle_start?: string;
          state?: string;
          outcome?: string | null;
          final_premium?: number | null;
          loss_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      renewal_events: {
        Row: {
          id: string;
          renewal_id: string;
          from_state: string | null;
          to_state: string;
          actor_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          renewal_id: string;
          from_state?: string | null;
          to_state: string;
          actor_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          renewal_id?: string;
          from_state?: string | null;
          to_state?: string;
          actor_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      campaign_configs: {
        Row: {
          user_id: string;
          windows: number[];
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          windows?: number[];
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          windows?: number[];
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_deliveries: {
        Row: {
          id: string;
          renewal_id: string;
          window_key: string;
          channel: string;
          status: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          renewal_id: string;
          window_key: string;
          channel?: string;
          status?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          renewal_id?: string;
          window_key?: string;
          channel?: string;
          status?: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          nit: string | null;
          contact_email: string | null;
          phone: string | null;
          status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nit?: string | null;
          contact_email?: string | null;
          phone?: string | null;
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          nit?: string | null;
          contact_email?: string | null;
          phone?: string | null;
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: 'super_admin' | 'ally_admin' | 'ally_technical';
          status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role: 'super_admin' | 'ally_admin' | 'ally_technical';
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role?: 'super_admin' | 'ally_admin' | 'ally_technical';
          status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: string;
          content: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          role?: string;
          content?: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      daas_market_snapshots: {
        Row: {
          id: string;
          source_analysis_id: string | null;
          quote_index: number;
          domain: string;
          insurer_name: string;
          policy_plan: string | null;
          price_annual: number | null;
          price_monthly: number | null;
          currency: string;
          deductibles_raw: string | null;
          coverages_summary: Json;
          score: number | null;
          period_month: string;
          region_macro: string;
          anonymized_at: string;
        };
        Insert: {
          id?: string;
          source_analysis_id?: string | null;
          quote_index?: number;
          domain?: string;
          insurer_name: string;
          policy_plan?: string | null;
          price_annual?: number | null;
          price_monthly?: number | null;
          currency?: string;
          deductibles_raw?: string | null;
          coverages_summary?: Json;
          score?: number | null;
          period_month?: string;
          region_macro?: string;
          anonymized_at?: string;
        };
        Update: {
          id?: string;
          source_analysis_id?: string | null;
          quote_index?: number;
          domain?: string;
          insurer_name?: string;
          policy_plan?: string | null;
          price_annual?: number | null;
          price_monthly?: number | null;
          currency?: string;
          deductibles_raw?: string | null;
          coverages_summary?: Json;
          score?: number | null;
          period_month?: string;
          region_macro?: string;
          anonymized_at?: string;
        };
        Relationships: [];
      };
      daas_api_usage: {
        Row: {
          id: string;
          subscriber_id: string;
          endpoint: string;
          query_params: Json;
          response_time_ms: number | null;
          status_code: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscriber_id: string;
          endpoint: string;
          query_params?: Json;
          response_time_ms?: number | null;
          status_code?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscriber_id?: string;
          endpoint?: string;
          query_params?: Json;
          response_time_ms?: number | null;
          status_code?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      daas_subscribers: {
        Row: {
          id: string;
          name: string;
          nit: string | null;
          contact_email: string;
          api_key_prefix: string;
          api_key_hash: string;
          tier: 'TIER_1' | 'TIER_2' | 'ENTERPRISE';
          monthly_quota: number;
          current_month_usage: number;
          rate_limit_per_minute: number;
          allowed_domains: string[];
          status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          nit?: string | null;
          contact_email: string;
          api_key_prefix: string;
          api_key_hash: string;
          tier?: 'TIER_1' | 'TIER_2' | 'ENTERPRISE';
          monthly_quota?: number;
          current_month_usage?: number;
          rate_limit_per_minute?: number;
          allowed_domains?: string[];
          status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          nit?: string | null;
          contact_email?: string;
          api_key_prefix?: string;
          api_key_hash?: string;
          tier?: 'TIER_1' | 'TIER_2' | 'ENTERPRISE';
          monthly_quota?: number;
          current_month_usage?: number;
          rate_limit_per_minute?: number;
          allowed_domains?: string[];
          status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_chunks_by_coverage: {
        Args: {
          p_embedding: string;
          p_insurer_id: string;
          p_coverage_tag?: string;
          p_match_count?: number;
        };
        Returns: {
          id: string;
          content: string;
          page_number: number;
          document_id: string;
          document_type: string;
          document_name: string;
          similarity: number;
        }[];
      };
      search_chunks_advanced: {
        Args: {
          p_embedding: string;
          p_insurer_id: string;
          p_coverage_tags?: string[];
          p_section_types?: string[];
          p_document_types?: string[];
          p_match_count?: number;
          p_min_similarity?: number;
        };
        Returns: {
          id: string;
          content: string;
          page_number: number;
          document_id: string;
          document_name: string;
          document_type: string;
          section_type: string;
          coverage_tags: string[];
          similarity: number;
        }[];
      };
      validate_quote_coverage: {
        Args: {
          p_quote_document_id: string;
          p_clause_document_id: string;
          p_coverage_tag: string;
          p_match_count?: number;
        };
        Returns: {
          quote_chunk_id: string;
          quote_content: string;
          quote_page: number;
          clause_chunk_id: string;
          clause_content: string;
          clause_page: number;
          similarity: number;
        }[];
      };
      get_chunks_with_images: {
        Args: {
          p_chunk_ids: string[];
        };
        Returns: {
          chunk_id: string;
          content: string;
          page_number: number;
          document_id: string;
          document_name: string;
          image_url: string;
          image_path: string;
        }[];
      };
      list_documents_by_insurer: {
        Args: {
          p_insurer_id: string;
          p_document_type?: string;
        };
        Returns: {
          document_id: string;
          document_name: string;
          document_type: string;
          version: string;
          total_pages: number;
          chunk_count: number;
          is_active: boolean;
          created_at: string;
        }[];
      };
      delete_document_complete: {
        Args: {
          p_document_id: string;
        };
        Returns: boolean;
      };
      verify_daas_api_key: {
        Args: {
          p_key_hash: string;
        };
        Returns: {
          subscriber_id: string;
          name: string;
          tier: string;
          monthly_quota: number;
          current_month_usage: number;
          rate_limit_per_minute: number;
          allowed_domains: string[];
          is_valid: boolean;
        }[];
      };
      get_executive_analytics_summary: {
        Args: {
          p_timeframe_days?: number;
        };
        Returns: Json;
      };
      get_daas_market_index: {
        Args: {
          p_domain?: string;
          p_period_months?: number;
        };
        Returns: Json;
      };
      get_organization_directory: {
        Args: Record<string, never>;
        Returns: Json;
      };
      is_org_member: {
        Args: {
          lookup_org_id: string;
        };
        Returns: boolean;
      };
      match_chunks_unified: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      match_chunks_vector_unified: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      match_chunks_hybrid: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      match_chunks: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      get_chunks_by_coverage_unified: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      get_parent_chunks: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      search_structured_clauses: {
        Args: Record<string, unknown>;
        Returns: unknown[];
      };
      get_clause_deductible: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      index_document_transaction: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
      try_acquire_campaign_lock: {
        Args: {
          lock_key: number;
        };
        Returns: boolean;
      };
      release_campaign_lock: {
        Args: {
          lock_key: number;
        };
        Returns: boolean;
      };
      exec_sql: {
        Args: {
          sql: string;
        };
        Returns: unknown;
      };
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
