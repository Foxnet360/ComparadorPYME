import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from 'fs';
import { ClauseDocument } from '../types';

// Initialize Gemini lazily
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment");
    }
    return new GoogleGenerativeAI(apiKey);
};

const getFileManager = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment");
    }
    return new GoogleAIFileManager(apiKey);
};

/**
 * Build optimized text from clause sections (not full text)
 * This reduces token usage by ~80% compared to full clause text
 */
const buildSectionText = (clauses: ClauseDocument[]): string => {
    if (clauses.length === 0) return '';

    const parts: string[] = [];

    for (const clause of clauses) {
        const { aseguradora, producto, version, secciones, textoCompleto } = clause;

        parts.push(`\n=== ${aseguradora} - ${producto} (${version}) ===`);

        // Use sections if available, otherwise fallback to full text
        if (secciones?.exclusiones || secciones?.deducibles || secciones?.garantias) {
            if (secciones.exclusiones) {
                parts.push('\n📛 EXCLUSIONES:');
                parts.push(secciones.exclusiones);
            }
            if (secciones.deducibles) {
                parts.push('\n💰 DEDUCIBLES:');
                parts.push(secciones.deducibles);
            }
            if (secciones.garantias) {
                parts.push('\n✅ GARANTÍAS:');
                parts.push(secciones.garantias);
            }

        } else {
            // Fallback to full text if no sections extracted
            parts.push('\n[CLAUSULADO COMPLETO - Secciones no extraídas]');
            parts.push(textoCompleto);

        }

        parts.push('===\n');
    }

    return parts.join('\n');
};

export const geminiService = {

    // Export buildSectionText for use in controller
    buildSectionText,

    uploadFile: async (filePath: string, mimeType: string, displayName: string) => {
        try {
            const fileManager = getFileManager();
            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType,
                displayName,
            });

            return uploadResult.file;
        } catch (error: any) {
            console.error("Error uploading to Gemini:", error);
            throw error;
        }
    },

    waitForFilesActive: async (files: any[]) => {
        const fileManager = getFileManager();
        for (const name of files.map((file) => file.name)) {
            let file = await fileManager.getFile(name);
            while (file.state === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(name);
            }
            if (file.state !== FileState.ACTIVE) {
                throw new Error(`File ${file.name} failed to process`);
            }
        }
    },

    /**
     * Generates content using Gemini with free-text output (NO JSON schema forcing)
     * 
     * @param text - The text to analyze
     * @param prompt - The extraction prompt
     * @returns Raw text response from Gemini
     */
    extractText: async (text: string, prompt: string): Promise<string> => {
        let retries = 0;
        const maxRetries = 3;

        while (true) {
            try {
                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 8192,
                    }
                });

                const result = await model.generateContent([
                    { text: prompt },
                    { text: `\n\n--- DOCUMENTO ---\n\n${text}` }
                ]);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const responseText = response.text();
                if (!responseText) {
                    throw new Error("Empty text response from Gemini");
                }

                console.log(`📄 [Gemini] Response received: ${responseText.length} chars`);
                
                return responseText;
            } catch (error: any) {
                const isRateLimit =
                    error.status === 429 ||
                    error.status === '429' ||
                    error.message?.includes("429") ||
                    error.message?.includes("Quota exceeded") ||
                    error.message?.includes("Too Many Requests");

                if (isRateLimit) {
                    console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries}...`);
                    if (retries >= maxRetries) {
                        console.error("Max retries exceeded for rate limit.");
                        throw error;
                    }
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 20000));
                    continue;
                }

                console.error("Error generating content:", error);
                throw error;
            }
        }
    },

    /**
     * Generate narrative text (recommendation, analysis) using Gemini
     * This is the only place where we use Gemini for text generation
     */
    generateNarrative: async (analysisData: any): Promise<{ recommendation: string; marketAnalysis: string }> => {
        const prompt = `Basado en el siguiente análisis de cotizaciones de seguros PYME, genera una recomendación profesional y un análisis de mercado.

DATOS DEL ANÁLISIS:
${JSON.stringify(analysisData, null, 2)}

REGLAS:
1. recommendation (máximo 1500 caracteres):
   - Recomienda la mejor cotización y explica por qué
   - Menciona pros y contras de cada opción
   - Sé específico y actionable

2. marketAnalysis (máximo 1500 caracteres):
   - Describe tendencias observadas en el mercado
   - Comenta rangos de precios
   - Menciona coberturas estándar vs diferenciadoras

Responde SOLO con el siguiente formato:

RECOMENDACIÓN:
[tu recomendación aquí]

ANÁLISIS DE MERCADO:
[tu análisis aquí]`;

        const text = await geminiService.extractText('', prompt);
        
        // Simple parsing of the response
        const recMatch = text.match(/RECOMENDACI[ÓO]N:\s*([\s\S]*?)(?=AN[ÁA]LISIS|$)/i);
        const marketMatch = text.match(/AN[ÁA]LISIS\s+DE\s+MERCADO:\s*([\s\S]*)/i);
        
        return {
            recommendation: recMatch ? recMatch[1].trim().substring(0, 1500) : 'No se pudo generar recomendación',
            marketAnalysis: marketMatch ? marketMatch[1].trim().substring(0, 1500) : 'No se pudo generar análisis'
        };
    }
};