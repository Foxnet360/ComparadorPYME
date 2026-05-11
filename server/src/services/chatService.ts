/**
 * Chat Service
 * Processes chat messages with optional RAG integration
 * Uses Gemini 2.5 Flash-Lite for cost efficiency
 */

import { GoogleGenAI } from '@google/genai';
import { ragRetrievalService } from './ragRetrievalService';
import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash-lite';

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
}

/**
 * Build system prompt for the chat
 */
const buildSystemPrompt = (): string => {
    return `Eres un asistente especializado en seguros para corredores de seguros en Colombia.

REGLAS ESTRICTAS:
1. Responde ÚNICAMENTE basado en el contexto proporcionado (cotizaciones y clausulados)
2. Si no tienes información suficiente en los clausulados, usa los datos de las cotizaciones del reporte
3. NUNCA digas "No tengo información suficiente" si hay datos de cotizaciones disponibles
4. Sé conciso y profesional
5. Usa formato markdown cuando sea útil (listas, negritas)
6. Si citas un clausulado, indica la aseguradora y página
7. Si usas datos de cotizaciones (sin clausulado), aclara: "Basado en la cotización..."
8. No inventes información ni hagas suposiciones
9. Si la pregunta es sobre comparación, sé objetivo y menciona pros/contras
10. Si la pregunta es sobre un riesgo, explica el impacto y sugiere mitigación

FORMATO DE RESPUESTA:
- Respuesta directa primero
- Detalles de soporte después
- Indica la fuente: clausulado o cotización`
};

/**
 * Build context from report data
 */
const buildReportContext = (reportContext: any): string => {
    if (!reportContext) return '';
    
    const quotes = reportContext.quotes || [];
    const summary = reportContext.summary || '';
    
    let context = `=== CONTEXTO DEL REPORTE ===\n`;
    
    if (summary) {
        context += `Resumen: ${summary}\n\n`;
    }
    
    quotes.forEach((quote: any, idx: number) => {
        context += `--- ASEGURADORA ${idx + 1}: ${quote.insurerName} ---\n`;
        context += `Score: ${quote.score || 'N/A'}/100\n`;
        context += `Prima Anual: ${quote.priceAnnual || 'N/A'}\n`;
        
        if (quote.coverages && quote.coverages.length > 0) {
            context += `Coberturas principales:\n`;
            quote.coverages.slice(0, 10).forEach((c: any) => {
                context += `- ${c.name}: ${c.value}${c.deductible ? ` (Ded: ${c.deductible})` : ''}\n`;
            });
        }
        
        if (quote.alerts && quote.alerts.length > 0) {
            context += `Alertas:\n`;
            quote.alerts.slice(0, 5).forEach((a: any) => {
                context += `- [${a.level}] ${a.title}: ${a.description}\n`;
            });
        }
        
        context += `\n`;
    });
    
    return context;
};

/**
 * Search RAG for relevant clauses
 */
const searchRAG = async (
    message: string,
    insurerNames: string[]
): Promise<ChatCitation[]> => {
    try {
        // Generate embedding for the query
        const queryEmbedding = await embeddingService.generateEmbedding(message);
        
        // Search across all insurers in the report
        const allClauses: ChatCitation[] = [];
        
        for (const insurerName of insurerNames) {
            const results = await ragRetrievalService.search(message, {
                insurerName,
                limit: 2
            });
            
            results.forEach(clause => {
                allClauses.push({
                    id: clause.id,
                    insurerName: clause.insurerName,
                    content: clause.content,
                    pageNumber: clause.pageNumber,
                    similarityScore: clause.similarity
                });
            });
        }
        
        // If no results per insurer, do general search
        if (allClauses.length === 0) {
            const generalResults = await ragRetrievalService.search(message, { limit: 3 });
            generalResults.forEach(clause => {
                allClauses.push({
                    id: clause.id,
                    insurerName: clause.insurerName,
                    content: clause.content,
                    pageNumber: clause.pageNumber,
                    similarityScore: clause.similarity
                });
            });
        }
        
        // Sort by similarity and deduplicate
        const uniqueClauses = allClauses
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .filter((clause, index, self) => 
                index === self.findIndex(c => c.id === clause.id)
            )
            .slice(0, 5);
        
        return uniqueClauses;
    } catch (error) {
        console.error('❌ [chatService] RAG search error:', error);
        return [];
    }
};

/**
 * Format citations for the prompt
 */
const formatCitationsForPrompt = (citations: ChatCitation[]): string => {
    if (citations.length === 0) return '';
    
    let formatted = '\n=== CLAUSULADOS RELEVANTES ===\n';
    
    citations.forEach((citation, idx) => {
        formatted += `[${idx + 1}] ${citation.insurerName} (pág. ${citation.pageNumber}):\n${citation.content}\n\n`;
    });
    
    return formatted;
};

/**
 * Count tokens roughly (approximation)
 */
const estimateTokens = (text: string): number => {
    // Rough estimate: ~4 characters per token for Spanish
    return Math.ceil(text.length / 4);
};

/**
 * Create or get chat thread
 */
export const getOrCreateThread = async (
    userId: string,
    reportId?: string
): Promise<string> => {
    try {
        // Try to find existing active thread for this report
        if (reportId) {
            const { data: existing } = await supabase
                .from('chat_threads')
                .select('id')
                .eq('user_id', userId)
                .eq('report_id', reportId)
                .order('updated_at', { ascending: false })
                .limit(1);
            
            if (existing && existing.length > 0) {
                return (existing[0] as any).id;
            }
        }
        
        // Create new thread
        const { data, error } = await supabase
            .from('chat_threads')
            .insert({
                user_id: userId,
                report_id: reportId,
                title: reportId ? 'Análisis de cotización' : 'Nueva conversación'
            } as any)
            .select()
            .single();
        
        if (error) throw error;
        return (data as any).id;
    } catch (error) {
        console.error('❌ [chatService] Error creating thread:', error);
        throw error;
    }
};

/**
 * Save message to database
 */
export const saveMessage = async (
    threadId: string,
    role: 'user' | 'model',
    content: string,
    citations: ChatCitation[] = [],
    modelUsed?: string,
    tokensUsed?: number
): Promise<void> => {
    try {
        await supabase
            .from('chat_messages')
            .insert({
                thread_id: threadId,
                role,
                content,
                citations: citations.length > 0 ? citations : null,
                model_used: modelUsed,
                tokens_used: tokensUsed
            } as any);
    } catch (error) {
        console.error('❌ [chatService] Error saving message:', error);
    }
};

/**
 * Get conversation history
 */
export const getConversationHistory = async (
    threadId: string,
    limit: number = 10
): Promise<ChatMessage[]> => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('role, content')
            .eq('thread_id', threadId)
            .order('created_at', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        
        return (data || []).map((msg: any) => ({
            role: msg.role,
            text: msg.content
        })).reverse();
    } catch (error) {
        console.error('❌ [chatService] Error getting history:', error);
        return [];
    }
};

/**
 * Build prompt with conversation history
 */
const buildPromptWithHistory = (
    systemPrompt: string,
    reportCtx: string,
    ragContext: string,
    history: ChatMessage[],
    currentMessage: string
): string => {
    let prompt = `${systemPrompt}\n\n${reportCtx}${ragContext}\n\n`;
    
    if (history.length > 0) {
        prompt += '=== HISTORIAL DE CONVERSACIÓN ===\n';
        history.forEach(msg => {
            prompt += `${msg.role === 'user' ? 'Usuario' : 'Asistente'}: ${msg.text}\n`;
        });
        prompt += '\n';
    }
    
    prompt += `=== PREGUNTA ACTUAL ===\n${currentMessage}`;
    
    return prompt;
};

/**
 * Process a chat message with persistence
 */
export const processChatMessage = async (
    message: string,
    reportContext: any,
    useRAG: boolean = true,
    userId: string = 'anonymous',
    threadId?: string
): Promise<ChatResponse> => {
    const startTime = Date.now();
    
    try {
        // Get or create thread
        const activeThreadId = threadId || await getOrCreateThread(
            userId, 
            reportContext?.id
        );
        
        // Save user message
        await saveMessage(activeThreadId, 'user', message);
        
        // Get conversation history
        const history = await getConversationHistory(activeThreadId, 10);
        
        // Build context
        const reportCtx = buildReportContext(reportContext);
        
        // RAG search if enabled
        let citations: ChatCitation[] = [];
        let ragContext = '';
        let usingReportFallback = false;
        
        if (useRAG && reportContext?.quotes) {
            const insurerNames = reportContext.quotes.map((q: any) => q.insurerName).filter(Boolean);
            citations = await searchRAG(message, insurerNames);
            
            // If RAG returned no results, use report context as fallback
            if (citations.length === 0) {
                console.log('⚠️ [chatService] RAG returned no results, using report context as fallback');
                ragContext = '\n=== NOTA ===\nNo se encontraron clausulados específicos para esta pregunta. La respuesta se basa en los datos de las cotizaciones.\n';
                usingReportFallback = true;
            } else {
                ragContext = formatCitationsForPrompt(citations);
            }
        }
        
        // Build the full prompt with history
        const systemPrompt = buildSystemPrompt();
        const fullPrompt = buildPromptWithHistory(
            systemPrompt,
            reportCtx,
            ragContext,
            history,
            message
        );
        
        // Estimate tokens
        const estimatedTokens = estimateTokens(fullPrompt);
        console.log(`🤖 [chatService] Estimated prompt tokens: ${estimatedTokens}`);
        
        // Call Gemini
        const model = genAI.models.generateContent({
            model: GEMINI_CHAT_MODEL,
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
        });
        
        const result = await model;
        const responseText = result.text || 'Lo siento, no pude generar una respuesta.';
        
        // Save model response
        await saveMessage(
            activeThreadId,
            'model',
            responseText,
            citations,
            GEMINI_CHAT_MODEL,
            estimatedTokens + estimateTokens(responseText)
        );
        
        console.log(`✅ [chatService] Response generated in ${Date.now() - startTime}ms`);
        
        return {
            text: responseText,
            citations,
            tokensUsed: estimatedTokens + estimateTokens(responseText),
            modelUsed: GEMINI_CHAT_MODEL
        };
    } catch (error) {
        console.error('❌ [chatService] Error processing message:', error);
        
        // Fallback to gemini-2.5-flash if flash-lite fails
        if (GEMINI_CHAT_MODEL === 'gemini-2.5-flash-lite') {
            console.log('🔄 [chatService] Falling back to gemini-2.5-flash...');
            try {
                const reportCtx = buildReportContext(reportContext);
                const systemPrompt = buildSystemPrompt();
                const fullPrompt = `${systemPrompt}\n\n${reportCtx}\n\n=== PREGUNTA ===\n${message}`;
                
                const fallbackResult = await genAI.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }]
                });
                
                return {
                    text: fallbackResult.text || 'Lo siento, no pude generar una respuesta.',
                    citations: [],
                    tokensUsed: estimateTokens(fullPrompt) + estimateTokens(fallbackResult.text || ''),
                    modelUsed: 'gemini-2.5-flash'
                };
            } catch (fallbackError) {
                console.error('❌ [chatService] Fallback also failed:', fallbackError);
            }
        }
        
        throw error;
    }
};

/**
 * Generate dynamic suggested questions based on report content
 */
export const generateSuggestedQuestions = (reportContext: any): string[] => {
    if (!reportContext || !reportContext.quotes) {
        return [
            '¿Qué coberturas incluye esta póliza?',
            '¿Cuál es el deducible promedio?',
            '¿Qué riesgos debo considerar?'
        ];
    }
    
    const questions: string[] = [];
    const quotes = reportContext.quotes;
    
    // Add questions based on alerts
    quotes.forEach((quote: any) => {
        if (quote.alerts && quote.alerts.length > 0) {
            const criticalAlert = quote.alerts.find((a: any) => a.level === 'CRITICAL');
            if (criticalAlert && questions.length < 5) {
                questions.push(`¿Por qué ${quote.insurerName} tiene el riesgo: "${criticalAlert.title}"?`);
            }
            
            const deductibleAlert = quote.alerts.find((a: any) => 
                a.title.toLowerCase().includes('deducible') || 
                a.description.toLowerCase().includes('deducible')
            );
            if (deductibleAlert && questions.length < 5) {
                questions.push(`¿Qué deducible tiene ${quote.insurerName}?`);
            }
        }
        
        // Score-based question
        if (quote.score !== undefined && quote.score < 70 && questions.length < 5) {
            questions.push(`¿Qué afectó el score de ${quote.insurerName}?`);
        }
    });
    
    // Comparison questions
    if (quotes.length >= 2) {
        const bestQuote = quotes.reduce((prev: any, current: any) => 
            ((prev.score || 0) > (current.score || 0)) ? prev : current
        );
        questions.push(`¿Por qué ${bestQuote.insurerName} es la mejor opción?`);
        
        // Price comparison
        const prices = quotes.filter((q: any) => q.priceAnnual);
        if (prices.length >= 2) {
            const cheapest = prices.reduce((prev: any, current: any) => 
                ((prev.priceAnnual || Infinity) < (current.priceAnnual || Infinity)) ? prev : current
            );
            questions.push(`¿${cheapest.insurerName} es la más económica, pero qué sacrifica?`);
        }
    }
    
    // Coverage gap questions
    const coverageNames = new Set<string>();
    quotes.forEach((q: any) => {
        q.coverages?.forEach((c: any) => {
            if (c.value && !['EXCLUIDO', 'NO CUBRE', 'NO APLICA'].includes(c.value.toUpperCase())) {
                coverageNames.add(c.name || c.canonicalName);
            }
        });
    });
    
    if (coverageNames.size > 0 && questions.length < 5) {
        const coverage = Array.from(coverageNames)[0];
        questions.push(`¿Qué cubre ${coverage}?`);
    }
    
    // Ensure we have at least 3 questions
    const defaultQuestions = [
        '¿Qué coberturas son más importantes para mi negocio?',
        '¿Cuál es la diferencia entre deducible sobre pérdida y sobre valor asegurado?',
        '¿Qué debo negociar con las aseguradoras?'
    ];
    
    while (questions.length < 3) {
        questions.push(defaultQuestions[questions.length]);
    }
    
    return questions.slice(0, 5);
};

export default {
    processChatMessage,
    generateSuggestedQuestions
};
