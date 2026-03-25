export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      insurers: {
        Row: {
          id: string
          name: string
          nit: string | null
          contact_email: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          nit?: string | null
          contact_email?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          nit?: string | null
          contact_email?: string | null
          phone?: string | null
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          insurer_id: string
          document_name: string
          document_type: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION'
          version: string | null
          total_pages: number | null
          storage_path: string
          file_hash: string | null
          is_active: boolean
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          insurer_id: string
          document_name: string
          document_type: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION'
          version?: string | null
          total_pages?: number | null
          storage_path: string
          file_hash?: string | null
          is_active?: boolean
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          insurer_id?: string
          document_name?: string
          document_type?: 'CLAUSULADO_GENERAL' | 'CLAUSULADO_PARTICULAR' | 'COTIZACION'
          version?: string | null
          total_pages?: number | null
          storage_path?: string
          file_hash?: string | null
          is_active?: boolean
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      page_images: {
        Row: {
          id: string
          document_id: string
          page_number: number
          storage_url: string
          storage_path: string
          ocr_text: string | null
          width: number | null
          height: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          page_number: number
          storage_url: string
          storage_path: string
          ocr_text?: string | null
          width?: number | null
          height?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          page_number?: number
          storage_url?: string
          storage_path?: string
          ocr_text?: string | null
          width?: number | null
          height?: number | null
          created_at?: string
        }
      }
      chunks: {
        Row: {
          id: string
          document_id: string
          page_number: number
          content: string
          content_normalized: string | null
          embedding: string | null // Vector as string representation (3072 dimensions)
          metadata: Json
          coverage_tags: string[] | null
          section_type: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          page_number: number
          content: string
          content_normalized?: string | null
          embedding?: string | null
          metadata?: Json
          coverage_tags?: string[] | null
          section_type?: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          page_number?: number
          content?: string
          content_normalized?: string | null
          embedding?: string | null
          metadata?: Json
          coverage_tags?: string[] | null
          section_type?: 'COBERTURA' | 'EXCLUSION' | 'DEDUCIBLE' | 'CONDICION' | 'GENERAL' | null
          created_at?: string
        }
      }
      analysis_history: {
        Row: {
          id: string
          user_id: string | null
          client_name: string
          quote_document_ids: string[] | null
          clause_document_ids: string[] | null
          analysis_result: Json
          recommendation: string | null
          total_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          client_name: string
          quote_document_ids?: string[] | null
          clause_document_ids?: string[] | null
          analysis_result: Json
          recommendation?: string | null
          total_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          client_name?: string
          quote_document_ids?: string[] | null
          clause_document_ids?: string[] | null
          analysis_result?: Json
          recommendation?: string | null
          total_score?: number | null
          created_at?: string
        }
      }
      storage_uploads: {
        Row: {
          id: string
          document_id: string
          file_path: string
          file_size: number | null
          upload_status: 'PENDING' | 'COMPLETED' | 'FAILED'
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          document_id: string
          file_path: string
          file_size?: number | null
          upload_status?: 'PENDING' | 'COMPLETED' | 'FAILED'
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          document_id?: string
          file_path?: string
          file_size?: number | null
          upload_status?: 'PENDING' | 'COMPLETED' | 'FAILED'
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
    }
    Functions: {
      search_chunks_by_coverage: {
        Args: {
          p_embedding: string
          p_insurer_id: string
          p_coverage_tag?: string
          p_match_count?: number
        }
        Returns: {
          id: string
          content: string
          page_number: number
          document_id: string
          document_type: string
          document_name: string
          similarity: number
        }[]
      }
      search_chunks_advanced: {
        Args: {
          p_embedding: string
          p_insurer_id: string
          p_coverage_tags?: string[]
          p_section_types?: string[]
          p_document_types?: string[]
          p_match_count?: number
          p_min_similarity?: number
        }
        Returns: {
          id: string
          content: string
          page_number: number
          document_id: string
          document_name: string
          document_type: string
          section_type: string
          coverage_tags: string[]
          similarity: number
        }[]
      }
      validate_quote_coverage: {
        Args: {
          p_quote_document_id: string
          p_clause_document_id: string
          p_coverage_tag: string
          p_match_count?: number
        }
        Returns: {
          quote_chunk_id: string
          quote_content: string
          quote_page: number
          clause_chunk_id: string
          clause_content: string
          clause_page: number
          similarity: number
        }[]
      }
      get_chunks_with_images: {
        Args: {
          p_chunk_ids: string[]
        }
        Returns: {
          chunk_id: string
          content: string
          page_number: number
          document_id: string
          document_name: string
          image_url: string
          image_path: string
        }[]
      }
      list_documents_by_insurer: {
        Args: {
          p_insurer_id: string
          p_document_type?: string
        }
        Returns: {
          document_id: string
          document_name: string
          document_type: string
          version: string
          total_pages: number
          chunk_count: number
          is_active: boolean
          created_at: string
        }[]
      }
      delete_document_complete: {
        Args: {
          p_document_id: string
        }
        Returns: boolean
      }
    }
  }
}
