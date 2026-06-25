/**
 * Document Repository
 * Database operations for documents and related tables
 */

import { supabase, handleDbError } from './baseRepository';

export interface DocumentRecord {
  id?: string;
  insurer_name: string;
  document_name: string;
  document_type: string;
  content?: string;
  page_count?: number;
  file_size?: number;
  created_at?: string;
  updated_at?: string;
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    handleDbError(error, 'Failed to fetch document');
  }

  return data as DocumentRecord | null;
}

export async function getDocumentsByInsurer(insurerName: string): Promise<DocumentRecord[]> {
  const { data, error } = await supabase
    .from('document_insurer_view' as never)
    .select('*')
    .eq('insurer_name', insurerName)
    .order('created_at', { ascending: false });

  if (error) {
    handleDbError(error, 'Failed to fetch documents by insurer');
  }

  return (data || []) as DocumentRecord[];
}

export async function archiveDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ status: 'archived', updated_at: new Date().toISOString() } as never)
    .eq('id', id);

  if (error) {
    handleDbError(error, 'Failed to archive document');
  }
}

export async function getDocumentCounts(id: string): Promise<{ chunks: number; images: number }> {
  const [{ count: chunkCount }, { count: imageCount }] = await Promise.all([
    supabase.from('document_chunks' as never).select('*', { count: 'exact', head: true }).eq('document_id', id),
    supabase.from('document_images' as never).select('*', { count: 'exact', head: true }).eq('document_id', id),
  ]);

  return { chunks: chunkCount || 0, images: imageCount || 0 };
}
