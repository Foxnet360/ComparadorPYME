/**
 * Orquestador del pipeline de análisis multi-fase
 * Coordina las 3 fases: Extracción → Scoring → Narrativa
 */

import { quoteExtractor } from './quoteExtractor';
import { quoteScorer } from './quoteScorer';
import { quoteNarrative } from './quoteNarrative';
import { CompleteAnalysis } from '../types/analysis';

export const multiPhaseAnalyzer = {
    analyze: async (quotesText: string): Promise<CompleteAnalysis> => {
        const startTime = Date.now();
        
        try {
            // Fase 1: Extracción
            const extractionResult = await quoteExtractor.extract(quotesText);
            
            if (!extractionResult.quotes || extractionResult.quotes.length === 0) {
                throw new Error('No se pudieron extraer cotizaciones');
            }
            
            // Fase 2: Scoring
            const scoringResult = await quoteScorer.score(extractionResult);
            
            // Fase 3: Narrativa
            const narrativeResult = await quoteNarrative.generate(
                extractionResult,
                scoringResult
            );
            
            // Combinar resultados
            const combinedQuotes = extractionResult.quotes.map((quote, index) => ({
                ...quote,
                ...scoringResult.quotes[index],
                // Campos adicionales esperados por el frontend
                priceMonthly: Math.round(quote.priceAnnual / 12),
                deductibles: quote.coverages
                    .map(c => `${c.name}: ${c.deductible}`)
                    .join('\n'),
                clientAnalysis: '', // Se llenará en futuras versiones
                technicalAnalysis: '' // Se llenará en futuras versiones
            }));
            
            const duration = Date.now() - startTime;
            console.log(`✅ Análisis completado en ${duration}ms`);
            
            return {
                quotes: combinedQuotes,
                recommendation: narrativeResult.recommendation,
                marketAnalysis: narrativeResult.marketAnalysis
            };
            
        } catch (error) {
            console.error('❌ Error en análisis multi-fase:', error);
            throw error;
        }
    }
};