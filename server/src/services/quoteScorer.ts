/**
 * Fase 2: Scoring y alerts
 * Calcula scores y genera alerts basado en datos extraídos
 */

import { geminiService } from './gemini';
import { ExtractionOutput, ScoringOutput } from '../types/analysis';

const SCORING_SCHEMA = {
    type: "OBJECT",
    properties: {
        quotes: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    insurerName: { type: "STRING" },
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
            }
        }
    }
};

const SCORING_PROMPT = `Analiza las siguientes cotizaciones de seguros y calcula un scoring.

REGLAS:
1. Para cada cotización, calcula:
   - coverage (1-10): Qué tan completa es la cobertura
   - deductibles (1-10): Qué tan favorables son los deducibles (10 = muy bajos)
   - exclusions (1-10): Qué tan pocas exclusiones tiene (10 = muy pocas)
   - priceRatio (1-10): Relación precio/cobertura (10 = excelente)
   - sublimits (1-10): Qué tan pocos sublímites (10 = muy pocos)
   - warranties (1-10): Qué tan fáciles son las garantías (10 = muy fáciles)

2. Score final = (coverage*0.25 + deductibles*0.20 + exclusions*0.20 + priceRatio*0.15 + sublimits*0.10 + warranties*0.10) * 10

3. Genera alerts:
   - CRITICAL: Problemas graves (deducibles muy altos, coberturas críticas faltantes)
   - WARNING: Precauciones importantes
   - GOOD: Aspectos destacados positivos
   - INFO: Datos relevantes neutrales

4. Devuelve SOLO el JSON, sin explicaciones adicionales`;

export const quoteScorer = {
    score: async (extractedData: ExtractionOutput): Promise<ScoringOutput> => {
        console.log('📊 [Fase 2/3] Calculando scores y alerts...');
        
        const inputText = JSON.stringify(extractedData, null, 2);
        
        const result = await geminiService.analyzeQuotesFromText(
            inputText,
            '',
            SCORING_PROMPT,
            SCORING_SCHEMA
        );
        
        console.log(`✅ [Fase 2/3] Scores calculados para ${result.quotes?.length || 0} cotizaciones`);
        return result as ScoringOutput;
    }
};