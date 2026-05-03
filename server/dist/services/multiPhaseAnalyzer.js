"use strict";
/**
 * Orquestador del pipeline de análisis multi-fase
 * Coordina las 3 fases: Extracción → Scoring → Narrativa
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiPhaseAnalyzer = void 0;
const quoteExtractor_1 = require("./quoteExtractor");
const quoteScorer_1 = require("./quoteScorer");
const quoteNarrative_1 = require("./quoteNarrative");
exports.multiPhaseAnalyzer = {
    analyze: (quotesText) => __awaiter(void 0, void 0, void 0, function* () {
        const startTime = Date.now();
        try {
            // Fase 1: Extracción (una por una)
            const extractionResult = yield quoteExtractor_1.quoteExtractor.extractAll(quotesText);
            if (!extractionResult.quotes || extractionResult.quotes.length === 0) {
                throw new Error('No se pudieron extraer cotizaciones');
            }
            // Fase 2: Scoring
            const scoringResult = yield quoteScorer_1.quoteScorer.scoreAll(extractionResult.quotes);
            // Fase 3: Narrativa
            const narrativeResult = yield quoteNarrative_1.quoteNarrative.generate(extractionResult.quotes, scoringResult);
            // Combinar resultados
            const combinedQuotes = extractionResult.quotes.map((quote, index) => (Object.assign(Object.assign(Object.assign({}, quote), scoringResult[index]), { 
                // Campos adicionales esperados por el frontend
                priceMonthly: Math.round(quote.priceAnnual / 12), deductibles: quote.coverages
                    .map(c => `${c.name}: ${c.deductible}`)
                    .join('\n'), clientAnalysis: '', technicalAnalysis: '' // Se llenará en futuras versiones
             })));
            const duration = Date.now() - startTime;
            console.log(`✅ Análisis completado en ${duration}ms`);
            return {
                quotes: combinedQuotes,
                recommendation: narrativeResult.recommendation,
                marketAnalysis: narrativeResult.marketAnalysis
            };
        }
        catch (error) {
            console.error('❌ Error en análisis multi-fase:', error);
            throw error;
        }
    })
};
