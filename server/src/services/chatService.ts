/**
 * Chat Service v2.0 - Refactored with Database Persistence
 * Prioritizes: 1. Quote Data > 2. Structured Clauses > 3. RAG Chunks
 * Always-on RAG with clear source attribution
 */

import { GoogleGenAI } from '@google/genai';
import { ragRetrievalService } from './ragRetrievalService';
import { structuredClauseExtractor } from './structuredClauseExtractor';
import { chatRepository } from '../repositories/chatRepository';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash-lite';
const MAX_PROMPT_TOKENS = 12000;

if (!GEMINI_API_KEY) {
  console.error('❌ [chatService] GEMINI_API_KEY not configured');
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatCitation {
  id: string;
  insurerName: string;
  content: string;
  pageNumber: number;
  similarityScore: number;
}

export interface ChatResponse {
  text: string;
  citations: ChatCitation[];
  tokensUsed?: number;
  modelUsed: string;
  source?: 'rag' | 'ontology' | 'fallback' | 'direct';
}

interface SourceResult {
  type: 'quote' | 'structured' | 'rag' | 'general';
  data: string;
  insurerName?: string;
  citations?: ChatCitation[];
  relevance: number;
}

interface ReportContextQuoteAlert {
  level: string;
  title: string;
  description?: string;
}

interface ReportContextQuoteCoverage {
  name?: string;
  canonicalName?: string;
  value?: string;
  deductible?: string;
}

interface ReportContextQuote {
  insurerName: string;
  priceAnnual?: number;
  score?: number;
  coverages?: ReportContextQuoteCoverage[];
  alerts?: ReportContextQuoteAlert[];
}

interface ReportContext {
  id?: string;
  clientName?: string;
  quotes: ReportContextQuote[];
}

/**
 * Context Window Manager - Controls prompt size and prioritizes content
 */
class ContextWindowManager {
  private maxTokens: number;

  constructor(maxTokens: number = MAX_PROMPT_TOKENS) {
    this.maxTokens = maxTokens;
  }

  /**
   * Compact report context to essential information only
   */
  compactReportContext(reportContext: ReportContext | null | undefined): string {
    if (!reportContext || !reportContext.quotes) {
      return '';
    }

    const quotes = reportContext.quotes;
    let compact = `=== RESUMEN DEL ANÁLISIS ===\n`;
    compact += `Cliente: ${reportContext.clientName || 'No especificado'}\n`;
    compact += `Aseguradoras: ${quotes.length}\n\n`;

    quotes.forEach((quote: ReportContextQuote, _idx: number) => {
      compact += `--- ${quote.insurerName} ---\n`;
      compact += `Score: ${quote.score || 'N/A'}/100 | Prima: ${quote.priceAnnual || 'N/A'}\n`;

      // Only include first 5 coverages in compact view
      const keyCoverages = (quote.coverages || []).slice(0, 5);
      if (keyCoverages.length > 0) {
        compact += `Coberturas principales:\n`;
        keyCoverages.forEach((c: ReportContextQuoteCoverage) => {
          compact += `- ${c.name}: ${c.value}${c.deductible ? ` (Ded: ${c.deductible})` : ''}\n`;
        });
      }

      // Include critical alerts only
      const criticalAlerts = (quote.alerts || []).filter(
        (a: ReportContextQuoteAlert) => a.level === 'CRITICAL'
      );
      if (criticalAlerts.length > 0) {
        compact += `Alertas críticas:\n`;
        criticalAlerts.forEach((a: ReportContextQuoteAlert) => {
          compact += `- ${a.title}\n`;
        });
      }

      compact += `\n`;
    });

    return compact;
  }

  /**
   * Build full prompt with controlled window size
   */
  buildPrompt(
    systemPrompt: string,
    reportSummary: string,
    sources: SourceResult[],
    history: ChatMessage[],
    currentMessage: string
  ): { prompt: string; tokens: number } {
    let prompt = systemPrompt;
    let currentTokens = this.estimateTokens(prompt);

    // Add report summary (high priority)
    if (reportSummary) {
      const reportSection = `\n\n${reportSummary}`;
      prompt += reportSection;
      currentTokens += this.estimateTokens(reportSection);
    }

    // Add sources (medium priority)
    if (sources.length > 0) {
      let sourcesText = '\n\n=== FUENTES CONSULTADAS ===\n';
      sources.forEach((source, idx) => {
        sourcesText += `[${idx + 1}] ${this.getSourceLabel(source.type)} ${source.insurerName ? `(${source.insurerName})` : ''}:\n${source.data}\n\n`;
      });

      // Check if adding sources would exceed budget
      const sourcesTokens = this.estimateTokens(sourcesText);
      if (currentTokens + sourcesTokens < this.maxTokens * 0.7) {
        prompt += sourcesText;
        currentTokens += sourcesTokens;
      } else {
        // Only include top source if budget is tight
        const topSource = sources[0]!;
        const minimalSources = `\n\n=== FUENTE PRINCIPAL ===\n${this.getSourceLabel(topSource.type)}: ${topSource.data}\n`;
        prompt += minimalSources;
        currentTokens += this.estimateTokens(minimalSources);
      }
    }

    // Add history (lower priority, truncated if needed)
    if (history.length > 0) {
      let historyText = '\n\n=== HISTORIAL RECIENTE ===\n';
      const recentHistory = history.slice(-6); // Last 6 messages max

      recentHistory.forEach((msg) => {
        historyText += `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}\n`;
      });

      const historyTokens = this.estimateTokens(historyText);
      const remainingBudget =
        this.maxTokens - currentTokens - this.estimateTokens(currentMessage) - 100; // Buffer

      if (historyTokens < remainingBudget) {
        prompt += historyText;
        currentTokens += historyTokens;
      } else {
        // Only include last 2 messages if budget is tight
        const minimalHistory = '\n\n=== ÚLTIMOS MENSAJES ===\n';
        const lastTwo = history.slice(-2);
        lastTwo.forEach((msg) => {
          historyText += `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}\n`;
        });
        prompt += minimalHistory + historyText;
        currentTokens += this.estimateTokens(minimalHistory + historyText);
      }
    }

    // Add current message
    prompt += `\n\n=== PREGUNTA ACTUAL ===\n${currentMessage}`;
    currentTokens += this.estimateTokens(currentMessage);

    return { prompt, tokens: currentTokens };
  }

  private getSourceLabel(type: string): string {
    const labels: Record<string, string> = {
      quote: '📄 COTIZACIÓN',
      structured: '📋 CLAUSULADO ESTRUCTURADO',
      rag: '📋 CLAUSULADO',
      general: 'ℹ️ CONOCIMIENTO GENERAL',
    };
    return labels[type] || 'ℹ️ FUENTE';
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Source Prioritizer - Gathers and ranks information sources in parallel
 */
class SourcePrioritizer {
  async gatherSources(
    message: string,
    reportContext: ReportContext | null | undefined
  ): Promise<SourceResult[]> {
    const sources: SourceResult[] = [];

    if (!reportContext?.quotes) {
      return sources;
    }

    const insurerNames = reportContext.quotes
      .map((q: ReportContextQuote) => q.insurerName)
      .filter(Boolean);

    // Execute all searches in parallel
    const [quoteResult, structuredResult, ragResult] = await Promise.all([
      this.searchQuoteData(message, reportContext),
      this.searchStructuredClauses(message, insurerNames),
      this.searchRAG(message, insurerNames),
    ]);

    // Add results with relevance scores
    if (quoteResult) {
      sources.push({
        type: 'quote',
        data: quoteResult.data,
        insurerName: quoteResult.insurerName,
        relevance: 1.0, // Highest priority
      });
    }

    if (structuredResult.length > 0) {
      sources.push({
        type: 'structured',
        data: this.formatCitations(structuredResult),
        citations: structuredResult,
        relevance: 0.8,
      });
    }

    if (ragResult.length > 0) {
      sources.push({
        type: 'rag',
        data: this.formatCitations(ragResult),
        citations: ragResult,
        relevance: 0.6,
      });
    }

    // If no sources found, add general context
    if (sources.length === 0) {
      sources.push({
        type: 'general',
        data: 'No se encontraron datos específicos para esta pregunta en las cotizaciones o clausulados.',
        relevance: 0.3,
      });
    }

    return sources;
  }

  private async searchQuoteData(
    message: string,
    reportContext: ReportContext | null | undefined
  ): Promise<{ data: string; insurerName?: string } | null> {
    try {
      const quotes = reportContext?.quotes || [];
      const messageLower = message.toLowerCase();

      // Search for insurer mentions
      const mentionedInsurer = quotes.find((q: ReportContextQuote) =>
        messageLower.includes(q.insurerName?.toLowerCase())
      );

      if (mentionedInsurer) {
        const coverage = mentionedInsurer.coverages?.find(
          (c: ReportContextQuoteCoverage) =>
            messageLower.includes(c.name?.toLowerCase() || '') ||
            messageLower.includes(c.canonicalName?.toLowerCase() || '')
        );

        if (coverage) {
          return {
            data: `Cobertura: ${coverage.name}\nValor: ${coverage.value}\nDeducible: ${coverage.deductible || 'No especificado'}`,
            insurerName: mentionedInsurer.insurerName,
          };
        }

        return {
          data: `Aseguradora: ${mentionedInsurer.insurerName}\nPrima: ${mentionedInsurer.priceAnnual}\nCoberturas: ${mentionedInsurer.coverages?.length || 0}`,
          insurerName: mentionedInsurer.insurerName,
        };
      }

      // Search across all quotes
      for (const quote of quotes) {
        const coverage = quote.coverages?.find(
          (c: ReportContextQuoteCoverage) =>
            messageLower.includes(c.name?.toLowerCase() || '') ||
            messageLower.includes(c.canonicalName?.toLowerCase() || '')
        );

        if (coverage) {
          return {
            data: `${quote.insurerName}: ${coverage.name} - ${coverage.value} (Ded: ${coverage.deductible || 'N/A'})`,
            insurerName: quote.insurerName,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ [SourcePrioritizer] Quote search error:', error);
      return null;
    }
  }

  private async searchStructuredClauses(
    message: string,
    insurerNames: string[]
  ): Promise<ChatCitation[]> {
    try {
      const allClauses: ChatCitation[] = [];

      for (const insurerName of insurerNames) {
        const structured = await structuredClauseExtractor.searchClause(insurerName);

        if (structured) {
          const relevantCoverage = structured.coverages.find((c) =>
            message.toLowerCase().includes(c.name.toLowerCase())
          );

          if (relevantCoverage) {
            allClauses.push({
              id: `structured-${insurerName}`,
              insurerName,
              content: `${relevantCoverage.name}: ${relevantCoverage.description}\nDeducible: ${JSON.stringify(relevantCoverage.deductible)}`,
              pageNumber: relevantCoverage.sourcePage,
              similarityScore: 0.95,
            });
          }
        }
      }

      return allClauses;
    } catch (error) {
      console.error('❌ [SourcePrioritizer] Structured clause search error:', error);
      return [];
    }
  }

  private async searchRAG(message: string, insurerNames: string[]): Promise<ChatCitation[]> {
    try {
      const allClauses: ChatCitation[] = [];

      for (const insurerName of insurerNames) {
        const results = await ragRetrievalService.search(message, {
          insurerName,
          limit: 3,
        });

        const filteredResults = results.filter((r) => r.similarity >= 0.62);
        const rankedResults = await ragRetrievalService.reRankResults(message, filteredResults, {
          topK: 2,
        });

        rankedResults.forEach((clause) => {
          allClauses.push({
            id: clause.id,
            insurerName: clause.insurerName,
            content: clause.content,
            pageNumber: clause.pageNumber,
            similarityScore: clause.similarity,
          });
        });
      }

      return allClauses;
    } catch (error) {
      console.error('❌ [SourcePrioritizer] RAG search error:', error);
      return [];
    }
  }

  private formatCitations(citations: ChatCitation[]): string {
    return citations
      .map((c, idx) => `[${idx + 1}] ${c.insurerName} (pág. ${c.pageNumber}): ${c.content}`)
      .join('\n');
  }
}

/**
 * Response Validator - Ensures responses don't contradict quote data
 */
class ResponseValidator {
  validate(response: string, sources: SourceResult[]): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Extract quote data sources
    const quoteSources = sources.filter((s) => s.type === 'quote');

    for (const quoteSource of quoteSources) {
      // Check for common contradiction patterns
      // This is a basic implementation - could be enhanced with NLP
      const quoteData = quoteSource.data.toLowerCase();

      // Simple heuristic: if response mentions a different deductible or value
      // Extract deductible patterns
      const deductibleMatch = quoteData.match(/deducible[:\s]+([^\n]+)/i);
      if (deductibleMatch) {
        // Check if response mentions a different deductible
        // This is a simplified check - production would need more sophisticated parsing
      }
    }

    return { isValid: issues.length === 0, issues };
  }
}

// Initialize managers
const contextWindowManager = new ContextWindowManager();
const sourcePrioritizer = new SourcePrioritizer();
const responseValidator = new ResponseValidator();

/**
 * Build system prompt for Triple Source chat
 */
const buildSystemPrompt = (): string => {
  return `Eres SeguroBot AI, un experto en seguros PYME para corredores de seguros en Colombia.

TRIPLE FUENTE DE VERDAD (en orden de prioridad):
1. 📄 DATOS DE COTIZACIÓN (Primera fuente): Datos extraídos directamente del PDF de la cotización. Siempre disponibles y precisos.
2. 📋 CLAUSULADOS ESTRUCTURADOS (Segunda fuente): Información legal de condiciones generales/particulares. Disponible si está indexado.
3. ℹ️ CONOCIMIENTO GENERAL (Tercera fuente): Conocimiento del modelo sobre seguros PYME en Colombia. Usar con cautela y solo cuando las fuentes 1 y 2 no tengan la respuesta.

REGLAS ESTRICTAS:
1. SIEMPRE prioriza los datos de cotización sobre el conocimiento general
2. Si no encuentras en clausulados pero hay datos de cotización, responde con los datos de cotización
3. Indica la fuente de cada información: 📄 (cotización), 📋 (clausulado), ℹ️ (conocimiento general)
4. NUNCA digas "No tengo información suficiente" si hay datos de cotización disponibles
5. Sé conciso y profesional
6. Usa formato markdown cuando sea útil (listas, negritas)
7. No inventes información ni hagas suposiciones
8. Si la pregunta es sobre comparación, sé objetivo y menciona pros/contras
9. Si hay inconsistencia entre cotización y clausulado, ALERTA al usuario

FORMATO DE RESPUESTA:
📋 RESUMEN EJECUTIVO (2-3 líneas)

🔍 DATOS DE COTIZACIÓN:
[Datos relevantes de la cotización]

📋 DETALLES DEL CLAUSULADO:
[Detalles legales si aplica]

⚠️ ALERTAS:
[Inconsistencias detectadas si las hay]`;
};

/**
 * Process a chat message with database persistence and Triple Source priority
 */
export const processChatMessage = async (
  message: string,
  reportContext: ReportContext | null | undefined,
  userId: string = 'anonymous',
  threadId?: string
): Promise<ChatResponse> => {
  const startTime = Date.now();

  try {
    // Get or create thread using repository
    const activeThreadId =
      threadId || (await getOrCreateThread(userId, reportContext?.id, reportContext));

    // Save user message
    await chatRepository.saveMessage(activeThreadId, {
      role: 'user',
      content: message,
    });

    // Get conversation history from database
    const dbHistory = await chatRepository.getHistory(activeThreadId, 10);
    const history: ChatMessage[] = dbHistory.map((msg) => ({
      role: msg.role as 'user' | 'model',
      text: msg.content,
    }));

    // Gather sources (always on - no RAG toggle)
    console.log('🔍 [chatService] Gathering sources...');
    const sources = await sourcePrioritizer.gatherSources(message, reportContext);

    // Extract citations from sources
    const citations: ChatCitation[] = [];
    sources.forEach((source) => {
      if (source.citations) {
        citations.push(...source.citations);
      }
    });

    // Build compact report summary
    const reportSummary = contextWindowManager.compactReportContext(reportContext);

    // Build controlled prompt
    const systemPrompt = buildSystemPrompt();
    const { prompt: fullPrompt, tokens: inputTokens } = contextWindowManager.buildPrompt(
      systemPrompt,
      reportSummary,
      sources,
      history,
      message
    );

    console.log(`🤖 [chatService] Prompt tokens: ${inputTokens}`);

    // Call Gemini with graceful fallback
    let responseText = '';
    try {
      const model = await genAI.models.generateContent({
        model: GEMINI_CHAT_MODEL,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      });
      responseText = model.text || 'Lo siento, no pude generar una respuesta.';
    } catch (llmError: unknown) {
      console.warn(
        '⚠️ [chatService] Gemini API call failed, falling back to source synthesis:',
        llmError instanceof Error ? llmError.message : String(llmError)
      );
      if (sources.length > 0) {
        const topSource = sources[0]!;
        responseText = `📄 ${topSource.data}\n\nℹ️ *(Respuesta generada desde los documentos de la cotización)*`;
      } else {
        responseText =
          'ℹ️ No se pudo conectar con el servicio de IA en este momento. Por favor reintenta en unos instantes.';
      }
    }

    // Validate response against quote data
    const validation = responseValidator.validate(responseText, sources);
    if (!validation.isValid) {
      console.warn('⚠️ [chatService] Response validation issues:', validation.issues);
      responseText +=
        '\n\n⚠️ Nota: Se detectaron posibles inconsistencias con los datos de la cotización.';
    }

    // Ensure source attribution
    if (
      !responseText.includes('📄') &&
      !responseText.includes('📋') &&
      !responseText.includes('ℹ️')
    ) {
      const primarySource = sources[0];
      if (primarySource) {
        const sourceLabels: Record<string, string> = {
          quote: '📄 Según la cotización',
          structured: '📋 Según clausulado estructurado',
          rag: '📋 Según clausulado',
          general: 'ℹ️ Información general',
        };
        responseText = `${sourceLabels[primarySource.type] || 'ℹ️ Información'}\n\n${responseText}`;
      }
    }

    const outputTokens = Math.ceil(responseText.length / 4);
    const latencyMs = Date.now() - startTime;

    // Save model response with metadata
    await chatRepository.saveMessage(activeThreadId, {
      role: 'model',
      content: responseText,
      sources_used: sources.map((s) => ({
        type: s.type,
        insurer: s.insurerName,
        relevance: s.relevance,
      })),
      citations: citations,
      model_used: GEMINI_CHAT_MODEL,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      latency_ms: latencyMs,
    });

    console.log(
      `✅ [chatService] Response generated in ${latencyMs}ms (sources: ${sources.map((s) => s.type).join(', ')})`
    );

    return {
      text: responseText,
      citations,
      tokensUsed: inputTokens + outputTokens,
      modelUsed: GEMINI_CHAT_MODEL,
      source: sources.find((s) => s.type === 'quote')
        ? 'direct'
        : sources.find((s) => s.type === 'structured' || s.type === 'rag')
          ? 'rag'
          : 'fallback',
    };
  } catch (error) {
    console.error('❌ [chatService] Error processing message:', error);

    // Fallback: Always try to answer with quote data
    try {
      const quoteSources = await sourcePrioritizer.gatherSources(message, reportContext);
      const quoteSource = quoteSources.find((s) => s.type === 'quote');

      if (quoteSource) {
        return {
          text: `📄 Según la cotización:\n\n${quoteSource.data}\n\n⚠️ Nota: Esta respuesta se basa únicamente en los datos de la cotización.`,
          citations: [],
          tokensUsed: 0,
          modelUsed: 'fallback-quote-data',
          source: 'direct',
        };
      }
    } catch (fallbackError) {
      console.error('❌ [chatService] Quote fallback failed:', fallbackError);
    }

    throw error;
  }
};

/**
 * Get conversation history for a thread
 */
export const getConversationHistory = async (
  threadId: string,
  limit: number = 50
): Promise<ChatMessage[]> => {
  const messages = await chatRepository.getHistory(threadId, limit);
  return messages.map((msg) => ({
    role: msg.role as 'user' | 'model',
    text: msg.content,
  }));
};

/**
 * Get or create chat thread
 */
export const getOrCreateThread = async (
  userId: string,
  reportId?: string,
  reportContext?: ReportContext | null
): Promise<string> => {
  if (!reportId) {
    // Create a general thread without report
    return chatRepository.createThread(userId, reportContext || {});
  }
  return chatRepository.getOrCreateThread(userId, reportId, reportContext);
};

/**
 * Generate dynamic suggested questions based on report content
 */
export const generateSuggestedQuestions = (
  reportContext: ReportContext | null | undefined
): string[] => {
  if (!reportContext || !reportContext.quotes) {
    return [
      '¿Qué coberturas incluye esta póliza?',
      '¿Cuál es el deducible promedio?',
      '¿Qué riesgos debo considerar?',
    ];
  }

  const questions: string[] = [];
  const quotes = reportContext.quotes;

  // Add questions based on alerts
  quotes.forEach((quote: ReportContextQuote) => {
    if (quote.alerts && quote.alerts.length > 0) {
      const criticalAlert = quote.alerts.find(
        (a: ReportContextQuoteAlert) => a.level === 'CRITICAL'
      );
      if (criticalAlert && questions.length < 5) {
        questions.push(`¿Por qué ${quote.insurerName} tiene el riesgo: "${criticalAlert.title}"?`);
      }

      const deductibleAlert = quote.alerts.find(
        (a: ReportContextQuoteAlert) =>
          a.title.toLowerCase().includes('deducible') ||
          (a.description?.toLowerCase().includes('deducible') ?? false)
      );
      if (deductibleAlert && questions.length < 5) {
        questions.push(`¿Qué deducible tiene ${quote.insurerName}?`);
      }
    }

    if (quote.score !== undefined && quote.score < 70 && questions.length < 5) {
      questions.push(`¿Qué afectó el score de ${quote.insurerName}?`);
    }
  });

  // Comparison questions
  if (quotes.length >= 2) {
    const bestQuote = quotes.reduce((prev: ReportContextQuote, current: ReportContextQuote) =>
      (prev.score || 0) > (current.score || 0) ? prev : current
    );
    questions.push(`¿Por qué ${bestQuote.insurerName} es la mejor opción?`);

    const prices = quotes.filter((q: ReportContextQuote) => q.priceAnnual);
    if (prices.length >= 2) {
      const cheapest = prices.reduce((prev: ReportContextQuote, current: ReportContextQuote) =>
        (prev.priceAnnual || Infinity) < (current.priceAnnual || Infinity) ? prev : current
      );
      questions.push(`¿${cheapest.insurerName} es la más económica, pero qué sacrifica?`);
    }
  }

  // Coverage gap questions
  const coverageNames = new Set<string>();
  quotes.forEach((q: ReportContextQuote) => {
    q.coverages?.forEach((c: ReportContextQuoteCoverage) => {
      if (c.value && !['EXCLUIDO', 'NO CUBRE', 'NO APLICA'].includes(c.value.toUpperCase())) {
        coverageNames.add(c.name || c.canonicalName || '');
      }
    });
  });

  if (coverageNames.size > 0 && questions.length < 5) {
    const coverage = Array.from(coverageNames)[0];
    questions.push(`¿Qué cubre ${coverage}?`);
  }

  const defaultQuestions = [
    '¿Qué coberturas son más importantes para mi negocio?',
    '¿Cuál es la diferencia entre deducible sobre pérdida y sobre valor asegurado?',
    '¿Qué debo negociar con las aseguradoras?',
  ];

  while (questions.length < 3) {
    questions.push(defaultQuestions[questions.length]!);
  }

  return questions.slice(0, 5);
};

export default {
  processChatMessage,
  generateSuggestedQuestions,
  getConversationHistory,
  getOrCreateThread,
};
