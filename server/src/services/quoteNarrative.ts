/**
 * Fase 3: Generación de narrativa
 * Crea recomendación y análisis de mercado
 */

import { geminiService } from './gemini';
import { ExtractedQuote, QuoteScore, NarrativeOutput } from '../types/analysis';

const NARRATIVE_SCHEMA = {
    type: "OBJECT",
    properties: {
        recommendation: { 
            type: "STRING",
            description: "Recomendación final de máximo 2000 caracteres"
        },
        marketAnalysis: { 
            type: "STRING",
            description: "Análisis de mercado de máximo 2000 caracteres"
        }
    }
};

const NARRATIVE_PROMPT = `Genera una recomendación final y análisis de mercado basado en las cotizaciones analizadas.

REGLAS:
1. recommendation (máximo 2000 chars):
   - Recomienda la mejor cotización y explica por qué
   - Menciona pros y contras de cada opción
   - Sé específico y actionable

2. marketAnalysis (máximo 2000 chars):
   - Describe tendencias observadas en el mercado
   - Comenta rangos de precios
   - Menciona coberturas estándar vs diferenciadoras

Responde SOLO con el JSON solicitado.`;

export const quoteNarrative = {
    generate: async (
        quotes: ExtractedQuote[],
        scores: QuoteScore[]
    ): Promise<NarrativeOutput> => {
        console.log('📝 [Fase 3/3] Generando análisis narrativo...');
        
        const inputText = JSON.stringify({
            quotes: quotes.map((q, i) => ({
                ...q,
                score: scores[i]?.score || 0,
                alerts: scores[i]?.alerts || []
            }))
        }, null, 2);
        
        const result = await geminiService.analyzeQuotesFromText(
            inputText,
            '',
            NARRATIVE_PROMPT,
            NARRATIVE_SCHEMA
        );
        
        console.log('✅ [Fase 3/3] Análisis narrativo completado');
        return result as NarrativeOutput;
    }
};