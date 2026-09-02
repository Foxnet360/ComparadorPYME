/**
 * Chat Repository
 * Handles database operations for chat threads and messages
 */

import { supabase } from '../config/database';

interface ReportContextQuoteAlert {
  level: string;
  title?: string;
  description?: string;
}

interface ReportContextQuoteCoverage {
  name?: string;
  canonicalName?: string;
  value?: string;
}

interface ReportContextQuote {
  insurerName?: string;
  priceAnnual?: number;
  score?: number;
  coverages?: ReportContextQuoteCoverage[];
  alerts?: ReportContextQuoteAlert[];
}

interface ReportContext {
  id?: string;
  clientName?: string;
  quotes?: ReportContextQuote[];
}

export interface ChatThread {
  id: string;
  user_id: string;
  report_id?: string;
  client_name?: string;
  insurer_names?: string[];
  title?: string;
  status: string;
  context_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageDB {
  id?: string;
  thread_id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  sources_used?: unknown[];
  citations?: unknown[];
  model_used?: string;
  tokens_input?: number;
  tokens_output?: number;
  tokens_used?: number; // legacy field for backward compatibility
  latency_ms?: number;
  created_at?: string;
}

export const chatRepository = {
  /**
   * Create a new chat thread for a report/analysis
   */
  async createThread(
    userId: string,
    reportContext: ReportContext | null | undefined
  ): Promise<string> {
    const insurerNames =
      reportContext?.quotes?.map((q: ReportContextQuote) => q.insurerName).filter(Boolean) || [];
    const clientName = reportContext?.clientName || 'Cliente Desconocido';
    const reportId = reportContext?.id;

    // Generate context summary
    const contextSummary = chatRepository.generateContextSummary(reportContext);

    const { data, error } = await supabase
      .from('chat_threads' as never)
      .insert({
        user_id: userId,
        report_id: reportId,
        client_name: clientName,
        insurer_names: insurerNames,
        title: `Análisis: ${clientName}`,
        status: 'active',
        context_summary: contextSummary,
      } as never)
      .select()
      .single();

    if (error) {
      console.error('❌ [chatRepository] Error creating thread:', error);
      throw error;
    }

    return (data as { id: string }).id;
  },

  /**
   * Get or create a thread for a specific report
   */
  async getOrCreateThread(
    userId: string,
    reportId: string,
    reportContext?: ReportContext | null | undefined
  ): Promise<string> {
    // Try to find existing active thread
    const { data: existing, error: findError } = await supabase
      .from('chat_threads' as never)
      .select('id')
      .eq('user_id', userId)
      .eq('report_id', reportId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (findError) {
      console.error('❌ [chatRepository] Error finding thread:', findError);
      throw findError;
    }

    if (existing && existing.length > 0) {
      return (existing[0]! as ChatThread).id;
    }

    // Create new thread
    return chatRepository.createThread(userId, reportContext || { id: reportId });
  },

  /**
   * Get thread by report ID
   */
  async getThreadByReport(userId: string, reportId: string): Promise<ChatThread | null> {
    const { data, error } = await supabase
      .from('chat_threads' as never)
      .select('*')
      .eq('user_id', userId)
      .eq('report_id', reportId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      console.error('❌ [chatRepository] Error getting thread:', error);
      throw error;
    }

    return data as ChatThread;
  },

  /**
   * Save a message to the database
   */
  async saveMessage(threadId: string, message: Omit<ChatMessageDB, 'thread_id'>): Promise<void> {
    const { error } = await supabase.from('chat_messages' as never).insert({
      thread_id: threadId,
      role: message.role,
      content: message.content,
      sources_used: message.sources_used || [],
      citations: message.citations || [],
      model_used: message.model_used,
      tokens_input: message.tokens_input,
      tokens_output: message.tokens_output,
      tokens_used:
        message.tokens_used ||
        (message.tokens_input && message.tokens_output
          ? message.tokens_input + message.tokens_output
          : undefined),
      latency_ms: message.latency_ms,
    } as never);

    if (error) {
      console.error('❌ [chatRepository] Error saving message:', error);
      throw error;
    }
  },

  /**
   * Get conversation history for a thread
   */
  async getHistory(threadId: string, limit: number = 20): Promise<ChatMessageDB[]> {
    const { data, error } = await supabase
      .from('chat_messages' as never)
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ [chatRepository] Error getting history:', error);
      throw error;
    }

    return (data || []).reverse() as ChatMessageDB[];
  },

  /**
   * Archive a thread (soft delete)
   */
  async archiveThread(threadId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_threads')
      // @ts-expect-error - Supabase type inference issue
      .update({ status: 'archived' })
      .eq('id', threadId);

    if (error) {
      console.error('❌ [chatRepository] Error archiving thread:', error);
      throw error;
    }
  },

  /**
   * List active threads for a user
   */
  async listUserThreads(userId: string): Promise<ChatThread[]> {
    const { data, error } = await supabase
      .from('chat_threads' as never)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [chatRepository] Error listing threads:', error);
      throw error;
    }

    return (data || []) as ChatThread[];
  },

  /**
   * Generate a compact context summary from report data
   */
  generateContextSummary(reportContext: ReportContext | null | undefined): string {
    if (!reportContext || !reportContext.quotes) {
      return 'No hay datos de cotización disponibles';
    }

    const quotes = reportContext.quotes;
    const insurerNames = quotes.map((q: ReportContextQuote) => q.insurerName).filter(Boolean);

    let summary = `Análisis de ${insurerNames.length} aseguradoras: ${insurerNames.join(', ')}. `;

    // Add key coverages
    const coverageNames = new Set<string>();
    quotes.forEach((q: ReportContextQuote) => {
      q.coverages?.forEach((c: ReportContextQuoteCoverage) => {
        if (c.value && !['EXCLUIDO', 'NO CUBRE', 'NO APLICA'].includes(c.value.toUpperCase())) {
          coverageNames.add((c.name || c.canonicalName) as string);
        }
      });
    });

    if (coverageNames.size > 0) {
      summary += `Coberturas principales: ${Array.from(coverageNames).slice(0, 5).join(', ')}. `;
    }

    // Add critical alerts
    const criticalAlerts = quotes.flatMap((q: ReportContextQuote) =>
      (q.alerts || []).filter((a: ReportContextQuoteAlert) => a.level === 'CRITICAL')
    );

    if (criticalAlerts.length > 0) {
      summary += `Alertas críticas: ${criticalAlerts.length}. `;
    }

    return summary;
  },
};

export default chatRepository;
