"use strict";
/**
 * Fase 3: Generación de narrativa
 * Crea recomendación y análisis de mercado
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
exports.quoteNarrative = void 0;
const gemini_1 = require("./gemini");
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
exports.quoteNarrative = {
    generate: (quotes, scores) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('📝 [Fase 3/3] Generando análisis narrativo...');
        const inputText = JSON.stringify({
            quotes: quotes.map((q, i) => {
                var _a, _b;
                return (Object.assign(Object.assign({}, q), { score: ((_a = scores[i]) === null || _a === void 0 ? void 0 : _a.score) || 0, alerts: ((_b = scores[i]) === null || _b === void 0 ? void 0 : _b.alerts) || [] }));
            })
        }, null, 2);
        const result = yield gemini_1.geminiService.analyzeQuotesFromText(inputText, '', NARRATIVE_PROMPT, NARRATIVE_SCHEMA);
        console.log('✅ [Fase 3/3] Análisis narrativo completado');
        return result;
    })
};
