/**
 * Chat Service - Triple Source Implementation
 * Prioritizes: 1. Quote Data > 2. Structured Clauses > 3. General Knowledge
 */

import { GoogleGenAI } from '@google/genai';
import { ragRetrievalService } from './ragRetrievalService';
import { embeddingService } from './vector/embeddingService';
import { supabase } from '../config/database';
import { structuredClauseExtractor } from './structuredClauseExtractor';

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
    source?: 'rag' | 'ontology' | 'fallback' | 'direct';
}

/**
 * Build system prompt for Triple Source chat
 */
const buildSystemPromptTripleSource = (): string => {
    return `Eres un asistente especializado en seguros para corredores de seguros en Colombia.

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
- Indica la fuente al inicio: 📄, 📋, o ℹ️
- Respuesta directa primero
- Detalles de soporte después`;
};

/**
 * Legacy system prompt (for backward compatibility)
 */
const buildSystemPrompt = (): string => {
    return buildSystemPromptTripleSource();
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
 * Search quote data for relevant information (Primary Source)
 */
/**
 * Search quote data semantically using coverage ontology
 */
const searchQuoteDataSemantically = async (
    message: string,
    reportContext: any
): Promise<{ data: string; source: string; insurerName?: string } | null> => {
    try {
        const quotes = reportContext?.quotes || [];
        const messageLower = message.toLowerCase();
        
        // Match user's question semantically to a canonical group
        const mapped = await require('./coverageOntology').coverageOntology.mapCoverage(message);
        
        if (mapped && mapped.groups.length > 0) {
            const bestGroupId = mapped.groups[0].groupId;
            console.log(`🧠 [chatService] Semantic quote search mapped query to group: "${bestGroupId}"`);
            
            const matchingInsurerData: string[] = [];
            let matchedInsurerName: string | undefined;
            
            for (const quote of quotes) {
                // Find coverages belonging to bestGroupId
                const matchingCoverages = (quote.coverages || []).filter((c: any) => 
                    c.categoryId === bestGroupId || 
                    c.canonicalName?.toLowerCase() === bestGroupId ||
                    c.name?.toLowerCase().includes(bestGroupId) ||
                    (bestGroupId === 'edificios' && c.name?.toLowerCase().includes('incendio')) ||
                    (bestGroupId === 'rce' && c.name?.toLowerCase().includes('responsabilidad'))
                );
                
                if (matchingCoverages.length > 0) {
                    matchedInsurerName = quote.insurerName;
                    matchingCoverages.forEach((c: any) => {
                        matchingInsurerData.push(`${quote.insurerName}: ${c.name} - $${c.value?.toLocaleString() || c.value} ${c.deductible ? `(Deducible: ${c.deductible})` : ''}`);
                    });
                }
            }
            
            if (matchingInsurerData.length > 0) {
                return {
                    data: matchingInsurerData.join('\n'),
                    source: 'quote',
                    insurerName: matchedInsurerName
                };
            }
        }
        
        // Fallback to simple includes search if semantic search found nothing
        return searchQuoteData(message, reportContext);
    } catch (error) {
        console.error('❌ [chatService] Semantic quote search error:', error);
        return searchQuoteData(message, reportContext);
    }
};

/**
 * Legacy Search quote data for relevant information (Primary Source)
 */
const searchQuoteData = (
    message: string,
    reportContext: any
): { data: string; source: string; insurerName?: string } | null => {
    try {
        const quotes = reportContext?.quotes || [];
        const messageLower = message.toLowerCase();
        
        // Search for insurer mentions
        const mentionedInsurer = quotes.find((q: any) => 
            messageLower.includes(q.insurerName?.toLowerCase())
        );
        
        if (mentionedInsurer) {
            // Search for coverage mentions in the message
            const coverage = mentionedInsurer.coverages?.find((c: any) => 
                messageLower.includes(c.name?.toLowerCase()) ||
                messageLower.includes(c.canonicalName?.toLowerCase())
            );
            
            if (coverage) {
                return {
                    data: `Cobertura: ${coverage.name}\nValor: ${coverage.value}\nDeducible: ${coverage.deductible || 'No especificado'}`,
                    source: 'quote',
                    insurerName: mentionedInsurer.insurerName
                };
            }
            
            // Return general quote info
            return {
                data: `Aseguradora: ${mentionedInsurer.insurerName}\nPrima: ${mentionedInsurer.priceAnnual}\nCoberturas: ${mentionedInsurer.coverages?.length || 0}`,
                source: 'quote',
                insurerName: mentionedInsurer.insurerName
            };
        }
        
        // Search across all quotes for coverage type
        for (const quote of quotes) {
            const coverage = quote.coverages?.find((c: any) => 
                messageLower.includes(c.name?.toLowerCase()) ||
                messageLower.includes(c.canonicalName?.toLowerCase())
            );
            
            if (coverage) {
                return {
                    data: `${quote.insurerName}: ${coverage.name} - ${coverage.value} (Ded: ${coverage.deductible || 'N/A'})`,
                    source: 'quote',
                    insurerName: quote.insurerName
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error('❌ [chatService] Quote search error:', error);
        return null;
    }
};

/**
 * Search structured clauses semantically (Secondary Source)
 */
const searchStructuredClauses = async (
    message: string,
    insurerNames: string[]
): Promise<ChatCitation[]> => {
    try {
        const allClauses: ChatCitation[] = [];
        
        // Map user's question semantically to a canonical group
        const mappedMessage = await require('./coverageOntology').coverageOntology.mapCoverage(message);
        const bestGroupId = mappedMessage?.groups?.[0]?.groupId;
        
        for (const insurerName of insurerNames) {
            // Try structured clause search first
            const structured = await structuredClauseExtractor.searchClause(insurerName);
            
            if (structured) {
                // Semantic matching: map clause's coverages and compare groups
                let matched = false;
                for (const cov of structured.coverages) {
                    const mappedCov = await require('./coverageOntology').coverageOntology.mapCoverage(cov.name);
                    const covGroupId = mappedCov?.groups?.[0]?.groupId;
                    
                    if (covGroupId && covGroupId === bestGroupId) {
                        allClauses.push({
                            id: `structured-${insurerName}-${cov.name}`,
                            insurerName,
                            content: `${cov.name}: ${cov.description}\nDeducible: ${JSON.stringify(cov.deductible || 'No especificado')}\nExclusiones asociadas: ${(cov.exclusions || []).slice(0, 3).join(', ')}`,
                            pageNumber: cov.sourcePage,
                            similarityScore: 0.95
                        });
                        matched = true;
                    }
                }
                
                // Fallback to simple includes search if semantic search didn't match anything
                if (!matched) {
                    const relevantCoverage = structured.coverages.find(c => 
                        message.toLowerCase().includes(c.name.toLowerCase())
                    );
                    
                    if (relevantCoverage) {
                        allClauses.push({
                            id: `structured-${insurerName}`,
                            insurerName,
                            content: `${relevantCoverage.name}: ${relevantCoverage.description}\nDeducible: ${JSON.stringify(relevantCoverage.deductible)}`,
                            pageNumber: relevantCoverage.sourcePage,
                            similarityScore: 0.95
                        });
                    }
                }
            }
        }
        
        return allClauses;
    } catch (error) {
        console.error('❌ [chatService] Structured clause search error:', error);
        return [];
    }
};


/**
 * Search RAG for relevant clauses (Tertiary Source)
 */
const searchRAG = async (
    message: string,
    insurerNames: string[]
): Promise<ChatCitation[]> => {
    try {
        const allClauses: ChatCitation[] = [];
        
        for (const insurerName of insurerNames) {
            // Retrieve slightly more candidates for better re-ranking
            const results = await ragRetrievalService.search(message, {
                insurerName,
                limit: 4
            });
            
            // Filter by 0.62 similarity threshold
            const filteredResults = results.filter(r => r.similarity >= 0.62);
            
            // Re-rank results using cross-encoder score blending
            const rankedResults = await ragRetrievalService.reRankResults(message, filteredResults, {
                topK: 2
            });
            
            rankedResults.forEach(clause => {
                allClauses.push({
                    id: clause.id,
                    insurerName: clause.insurerName,
                    content: clause.content,
                    pageNumber: clause.pageNumber,
                    similarityScore: clause.similarity
                });
            });
        }
        
        return allClauses;
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
 * Process a chat message with Triple Source priority
 * 1. Quote Data (Primary) > 2. Structured Clauses (Secondary) > 3. RAG (Tertiary)
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
        
        // TRIPLE SOURCE SEARCH
        let citations: ChatCitation[] = [];
        let sourceContext = '';
        let sourcesUsed: string[] = [];
        
        if (reportContext?.quotes) {
            const insurerNames = reportContext.quotes.map((q: any) => q.insurerName).filter(Boolean);
            
            // SOURCE 1: Quote Data (Primary)
            console.log('🔍 [chatService] Searching quote data semantically...');
            const quoteResult = await searchQuoteDataSemantically(message, reportContext);
            
            if (quoteResult) {
                sourceContext += `\n=== DATOS DE COTIZACIÓN ===\n${quoteResult.data}\n`;
                sourcesUsed.push('quote');
                console.log('✅ [chatService] Found in quote data semantically');
            }
            
            // SOURCE 2: Structured Clauses (Secondary)
            let structuredCitations: ChatCitation[] = [];
            if (useRAG) {
                console.log('🔍 [chatService] Searching structured clauses...');
                structuredCitations = await searchStructuredClauses(message, insurerNames);
                
                if (structuredCitations.length > 0) {
                    sourceContext += formatCitationsForPrompt(structuredCitations);
                    citations.push(...structuredCitations);
                    sourcesUsed.push('structured');
                    console.log(`✅ [chatService] Found ${structuredCitations.length} structured clauses`);
                }
            }
            
            // SOURCE 3: RAG (Tertiary) - only if no structured results
            if (useRAG && structuredCitations.length === 0) {
                console.log('🔍 [chatService] Searching RAG...');
                const ragCitations = await searchRAG(message, insurerNames);
                
                if (ragCitations.length > 0) {
                    sourceContext += formatCitationsForPrompt(ragCitations);
                    citations.push(...ragCitations);
                    sourcesUsed.push('rag');
                    console.log(`✅ [chatService] Found ${ragCitations.length} RAG results`);
                }
            }
            
            // If no sources found but quote data exists, use general quote context
            if (sourcesUsed.length === 0 && quoteResult === null) {
                sourceContext = '\n=== NOTA ===\nNo se encontraron datos específicos para esta pregunta, pero hay cotizaciones disponibles para consulta general.\n';
                sourcesUsed.push('general');
            }
        }
        
        // Build the full prompt with history
        let systemPrompt = buildSystemPromptTripleSource();
        if (reportContext?.pymeSector) {
            systemPrompt += `\n\nEl cliente es una PYME del sector: **${reportContext.pymeSector}**.
Ten esto en cuenta al dar asesoría técnica. Por ejemplo:
- Si es Restaurantes/Alimentos: prioriza Daños por Agua, Congelación, RCE Alimentos, e Interrupción.
- Si es Oficinas/Servicios/Tecnología: prioriza Equipo Eléctrico y Electrónico, Portabilidad, y RCE Profesional.
- Si es Manufactura/Talleres: prioriza Rotura de Maquinaria, Incendio Combustión Espontánea, y Lucro Cesante.
- Si es Comercio/Retail: prioriza Sustracción, Transporte de Mercancías y Valores.
Adapta el tono, las alertas y las advertencias técnicas según la actividad económica del cliente.`;
        }

        const fullPrompt = buildPromptWithHistory(
            systemPrompt,
            reportCtx,
            sourceContext,
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
        let responseText = result.text || 'Lo siento, no pude generar una respuesta.';
        
        // Add source attribution if not already present
        if (!responseText.includes('📄') && !responseText.includes('📋') && !responseText.includes('ℹ️')) {
            const sourceLabels: Record<string, string> = {
                'quote': '📄 Según la cotización',
                'structured': '📋 Según clausulado estructurado',
                'rag': '📋 Según clausulado',
                'general': 'ℹ️ Información general'
            };
            
            const primarySource = sourcesUsed[0] || 'general';
            responseText = `${sourceLabels[primarySource]}\n\n${responseText}`;
        }
        
        // Save model response
        await saveMessage(
            activeThreadId,
            'model',
            responseText,
            citations,
            GEMINI_CHAT_MODEL,
            estimatedTokens + estimateTokens(responseText)
        );
        
        console.log(`✅ [chatService] Response generated in ${Date.now() - startTime}ms (sources: ${sourcesUsed.join(', ')})`);
        
        return {
            text: responseText,
            citations,
            tokensUsed: estimatedTokens + estimateTokens(responseText),
            modelUsed: GEMINI_CHAT_MODEL,
            source: sourcesUsed.includes('quote') ? 'direct' :
                    sourcesUsed.includes('structured') ? 'rag' :
                    sourcesUsed.includes('rag') ? 'rag' :
                    sourcesUsed.includes('general') ? 'fallback' : 'fallback'
        };
    } catch (error) {
        console.error('❌ [chatService] Error processing message:', error);
        
        // Fallback: Always try to answer with quote data
        try {
            const quoteResult = searchQuoteData(message, reportContext);
            if (quoteResult) {
                return {
                    text: `📄 Según la cotización:\n\n${quoteResult.data}\n\n⚠️ Nota: Esta respuesta se basa únicamente en los datos de la cotización.`,
                    citations: [],
                    tokensUsed: 0,
                    modelUsed: 'fallback-quote-data',
                    source: 'direct'
                };
            }
        } catch (fallbackError) {
            console.error('❌ [chatService] Quote fallback failed:', fallbackError);
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
