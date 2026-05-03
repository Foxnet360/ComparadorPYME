"use strict";
/**
 * Fase 1: Extracción de datos estructurados de cotizaciones
 * PROCESA UNA COTIZACIÓN POR LLAMADA para evitar truncamiento
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
exports.quoteExtractor = void 0;
const gemini_1 = require("./gemini");
const SINGLE_QUOTE_SCHEMA = {
    type: "OBJECT",
    properties: {
        insurerName: { type: "STRING" },
        policyName: { type: "STRING" },
        priceAnnual: { type: "NUMBER" },
        currency: { type: "STRING" },
        coverages: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    name: { type: "STRING" },
                    value: { type: "STRING" },
                    deductible: { type: "STRING" }
                }
            }
        }
    }
};
const EXTRACTION_PROMPT = `Extrae datos estructurados de ESTA cotización de seguro.

REGLAS:
1. Extrae SOLO datos brutos, NO hagas análisis
2. Identifica: Aseguradora, Nombre de Póliza, Prima Anual, Moneda
3. Lista las coberturas con: nombre, valor asegurado, deducible
4. Si un valor no está especificado, usa "NO ESPECIFICADO"
5. Si no hay deducible, usa "No aplica"

Responde SOLO con el JSON solicitado, sin texto adicional.`;
exports.quoteExtractor = {
    extractOne: (singleQuoteText) => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield gemini_1.geminiService.analyzeQuotesFromText(singleQuoteText, '', EXTRACTION_PROMPT, SINGLE_QUOTE_SCHEMA);
        return result;
    }),
    extractAll: (combinedQuotesText) => __awaiter(void 0, void 0, void 0, function* () {
        console.log('🔍 [Fase 1/3] Extrayendo datos de cotizaciones (una por una)...');
        // Dividir el texto combinado en cotizaciones individuales
        // Buscando los marcadores === INICIO/FIN ===
        const quoteRegex = /=== INICIO COTIZACIÓN: (.+?) ===([\s\S]*?)=== FIN COTIZACIÓN ===/g;
        const matches = [...combinedQuotesText.matchAll(quoteRegex)];
        const quotes = [];
        if (matches.length === 0) {
            // Si no hay marcadores, intentar procesar todo como una sola cotización
            console.log('  No se encontraron marcadores, procesando como cotización única...');
            const quote = yield exports.quoteExtractor.extractOne(combinedQuotesText);
            quotes.push(quote);
        }
        else {
            for (let i = 0; i < matches.length; i++) {
                console.log(`  Procesando cotización ${i + 1}/${matches.length}...`);
                const quoteText = matches[i][0];
                try {
                    const quote = yield exports.quoteExtractor.extractOne(quoteText);
                    quotes.push(quote);
                }
                catch (error) {
                    console.error(`  ❌ Error extrayendo cotización ${i + 1}:`, error);
                    // Continuar con la siguiente
                }
            }
        }
        console.log(`✅ [Fase 1/3] Extraídas ${quotes.length} cotizaciones`);
        return { quotes };
    })
};
