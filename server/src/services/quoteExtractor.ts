/**
 * Fase 1: Extracción de datos estructurados de cotizaciones
 * Extrae datos brutos sin análisis ni scoring
 */

import { geminiService } from './gemini';
import { ExtractionOutput } from '../types/analysis';

const EXTRACTION_SCHEMA = {
    type: "OBJECT",
    properties: {
        quotes: {
            type: "ARRAY",
            items: {
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
            }
        }
    }
};

const EXTRACTION_PROMPT = `Extrae datos estructurados de las siguientes cotizaciones de seguros.

REGLAS:
1. Extrae SOLO datos brutos, NO hagas análisis ni comparaciones
2. Para cada cotización, identifica: Aseguradora, Nombre de Póliza, Prima Anual, Moneda
3. Lista TODAS las coberturas encontradas con: nombre, valor asegurado, deducible
4. Si un valor no está especificado, usa "NO ESPECIFICADO"
5. Si no hay deducible, usa "No aplica"
6. Mantén los nombres originales de coberturas tal como aparecen en el documento`;

export const quoteExtractor = {
    extract: async (quotesText: string): Promise<ExtractionOutput> => {
        console.log('🔍 [Fase 1/3] Extrayendo datos de cotizaciones...');
        
        const result = await geminiService.analyzeQuotesFromText(
            quotesText,
            '',
            EXTRACTION_PROMPT,
            EXTRACTION_SCHEMA
        );
        
        console.log(`✅ [Fase 1/3] Extraídas ${result.quotes?.length || 0} cotizaciones`);
        return result as ExtractionOutput;
    },

    extractBatch: async (quotesTexts: string[]): Promise<ExtractionOutput> => {
        console.log(`🔍 [Fase 1/3] Extrayendo ${quotesTexts.length} lotes de cotizaciones...`);
        
        const allQuotes: ExtractionOutput['quotes'] = [];
        
        for (let i = 0; i < quotesTexts.length; i++) {
            console.log(`  Procesando lote ${i + 1}/${quotesTexts.length}...`);
            const result = await quoteExtractor.extract(quotesTexts[i]);
            allQuotes.push(...result.quotes);
        }
        
        console.log(`✅ [Fase 1/3] Total extraídas: ${allQuotes.length} cotizaciones`);
        return { quotes: allQuotes };
    }
};