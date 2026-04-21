/**
 * Fase 3: Generación de narrativa
 * Crea recomendación y análisis de mercado
 */

import { geminiService } from './gemini';
import { ExtractionOutput, ScoringOutput, NarrativeOutput } from '../types/analysis';

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

3. Mantén un tono profesional pero accesible
4. Usa formato markdown ligero si es útil
5. Devuelve SOLO el JSON solicitado`;

export const quoteNarrative = {
    generate: async (
        extractedData: ExtractionOutput,
        scoringData: ScoringOutput
    ): Promise<NarrativeOutput> => {
        console.log('📝 [Fase 3/3] Generando análisis narrativo...');
        
        const inputText = JSON.stringify({
            quotes: extractedData.quotes.map((q, i) => ({
                ...q,
                ...scoringData.quotes[i]
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