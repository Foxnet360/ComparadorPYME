/**
 * Fase 1: Extracción de datos estructurados de cotizaciones
 * PROCESA UNA COTIZACIÓN POR LLAMADA para evitar truncamiento
 */

import { geminiService } from './gemini';
import { ExtractionOutput, ExtractedQuote } from '../types/analysis';

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

export const quoteExtractor = {
    extractOne: async (singleQuoteText: string): Promise<ExtractedQuote> => {
        const result = await geminiService.analyzeQuotesFromText(
            singleQuoteText,
            '',
            EXTRACTION_PROMPT,
            SINGLE_QUOTE_SCHEMA
        );
        
        return result as ExtractedQuote;
    },

    extractAll: async (combinedQuotesText: string): Promise<ExtractionOutput> => {
        console.log('🔍 [Fase 1/3] Extrayendo datos de cotizaciones (una por una)...');
        
        // Dividir el texto combinado en cotizaciones individuales
        // Buscando los marcadores === INICIO/FIN ===
        const quoteRegex = /=== INICIO COTIZACIÓN: (.+?) ===([\s\S]*?)=== FIN COTIZACIÓN ===/g;
        const matches = [...combinedQuotesText.matchAll(quoteRegex)];
        
        const quotes: ExtractedQuote[] = [];
        
        if (matches.length === 0) {
            // Si no hay marcadores, intentar procesar todo como una sola cotización
            console.log('  No se encontraron marcadores, procesando como cotización única...');
            const quote = await quoteExtractor.extractOne(combinedQuotesText);
            quotes.push(quote);
        } else {
            for (let i = 0; i < matches.length; i++) {
                console.log(`  Procesando cotización ${i + 1}/${matches.length}...`);
                const quoteText = matches[i][0];
                try {
                    const quote = await quoteExtractor.extractOne(quoteText);
                    quotes.push(quote);
                } catch (error) {
                    console.error(`  ❌ Error extrayendo cotización ${i + 1}:`, error);
                    // Continuar con la siguiente
                }
            }
        }
        
        console.log(`✅ [Fase 1/3] Extraídas ${quotes.length} cotizaciones`);
        return { quotes };
    }
};