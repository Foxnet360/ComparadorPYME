/**
 * Fase 2: Scoring y alerts
 * Calcula scores y genera alerts basado en datos extraídos
 * PROCESA UNA COTIZACIÓN POR LLAMADA
 */

import { geminiService } from './gemini';
import { ExtractedQuote, QuoteScore } from '../types/analysis';

const SINGLE_SCORE_SCHEMA = {
    type: "OBJECT",
    properties: {
        score: { type: "NUMBER", description: "Score de 0 a 100" },
        scoringBreakdown: {
            type: "OBJECT",
            properties: {
                coverage: { type: "NUMBER", description: "1-10" },
                deductibles: { type: "NUMBER", description: "1-10" },
                exclusions: { type: "NUMBER", description: "1-10" },
                priceRatio: { type: "NUMBER", description: "1-10" },
                sublimits: { type: "NUMBER", description: "1-10" },
                warranties: { type: "NUMBER", description: "1-10" }
            }
        },
        alerts: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    level: { type: "STRING", enum: ['CRITICAL', 'WARNING', 'GOOD', 'INFO'] },
                    title: { type: "STRING" },
                    description: { type: "STRING" }
                }
            }
        }
    }
};

const SCORING_PROMPT = `Analiza esta cotización de seguro y calcula un scoring.

REGLAS:
1. Calcula dimensiones (1-10):
   - coverage: Qué tan completa es la cobertura
   - deductibles: Qué tan favorables son los deducibles (10 = muy bajos)
   - exclusions: Qué tan pocas exclusiones tiene (10 = muy pocas)  
   - priceRatio: Relación precio/cobertura (10 = excelente)
   - sublimits: Qué tan pocos sublímites (10 = muy pocos)
   - warranties: Qué tan fáciles son las garantías (10 = muy fáciles)

2. Score final = (coverage*0.25 + deductibles*0.20 + exclusions*0.20 + priceRatio*0.15 + sublimits*0.10 + warranties*0.10) * 10

3. Genera alerts si hay problemas graves o aspectos destacados.

Responde SOLO con el JSON solicitado.`;

export const quoteScorer = {
    scoreOne: async (quote: ExtractedQuote): Promise<QuoteScore> => {
        const inputText = JSON.stringify(quote, null, 2);
        
        const result = await geminiService.analyzeQuotesFromText(
            inputText,
            '',
            SCORING_PROMPT,
            SINGLE_SCORE_SCHEMA
        );
        
        return {
            insurerName: quote.insurerName,
            ...result
        } as QuoteScore;
    },

    scoreAll: async (quotes: ExtractedQuote[]): Promise<QuoteScore[]> => {
        console.log('📊 [Fase 2/3] Calculando scores y alerts (uno por uno)...');
        
        const scores: QuoteScore[] = [];
        
        for (let i = 0; i < quotes.length; i++) {
            console.log(`  Scoring cotización ${i + 1}/${quotes.length}...`);
            try {
                const score = await quoteScorer.scoreOne(quotes[i]);
                scores.push(score);
            } catch (error) {
                console.error(`  ❌ Error en scoring ${i + 1}:`, error);
                // Agregar score genérico para no romper el flujo
                scores.push({
                    insurerName: quotes[i].insurerName,
                    score: 0,
                    scoringBreakdown: {
                        coverage: 0, deductibles: 0, exclusions: 0,
                        priceRatio: 0, sublimits: 0, warranties: 0
                    },
                    alerts: [{
                        level: 'WARNING',
                        title: 'Error en análisis',
                        description: 'No se pudo completar el scoring'
                    }]
                });
            }
        }
        
        console.log(`✅ [Fase 2/3] Scores calculados para ${scores.length} cotizaciones`);
        return scores;
    }
};