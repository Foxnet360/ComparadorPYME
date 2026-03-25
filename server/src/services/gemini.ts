import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from 'fs';
import { ClauseDocument } from '../types';
import { validateAnalysis } from '../utils/analysisValidator';

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
            console.log(`📊 Using sections for ${aseguradora} (~${((secciones.exclusiones?.length || 0) + (secciones.deducibles?.length || 0) + (secciones.garantias?.length || 0)) / 4} tokens)`);
        } else {
            // Fallback to full text if no sections extracted
            parts.push('\n[CLAUSULADO COMPLETO - Secciones no extraídas]');
            parts.push(textoCompleto);
            console.log(`⚠️ Using full text for ${aseguradora} (~${textoCompleto.length / 4} tokens)`);
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

            console.log(`Uploaded file ${displayName}: ${uploadResult.file.name}`);
            return uploadResult.file;
        } catch (error: any) {
            console.error("Error uploading to Gemini:", error);
            throw error;
        }
    },

    waitForFilesActive: async (files: any[]) => {
        const fileManager = getFileManager();
        console.log("Waiting for files to be processed...");
        for (const name of files.map((file) => file.name)) {
            let file = await fileManager.getFile(name);
            while (file.state === FileState.PROCESSING) {
                process.stdout.write(".");
                await new Promise((resolve) => setTimeout(resolve, 2000));
                file = await fileManager.getFile(name);
            }
            if (file.state !== FileState.ACTIVE) {
                throw new Error(`File ${file.name} failed to process`);
            }
        }
        console.log("All files ready.");
    },

    analyzeQuotes: async (quoteFiles: any[], clauseFiles: any[], prompt: string, schema: any) => {
        // Construct parts
        const fileParts = [
            ...quoteFiles.map(f => ({ fileData: { fileUri: f.uri, mimeType: f.mimeType } })),
            ...clauseFiles.map(f => ({ fileData: { fileUri: f.uri, mimeType: f.mimeType } }))
        ];

        let retries = 0;
        const maxRetries = 3;

        while (true) {
            try {
                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        temperature: 0,
                        topP: 0,
                        topK: 1,
                    }
                });

                console.log(`Generating content with model: models/gemini-2.5-flash with ${fileParts.length} files`);
                const result = await model.generateContent([
                    ...fileParts,
                    { text: prompt }
                ]);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const text = response.text();
                // console.log("Raw Gemini Response:", text.substring(0, 500) + "...");
                if (!text) {
                    throw new Error("Empty text response from Gemini");
                }

                console.log("✅ Gemini analysis successful and parsed.");
                const parsed = JSON.parse(text);
                // Validar y completar coberturas
                return validateAnalysis(parsed);
            } catch (error: any) {
                console.log(`Debug Error Analysis - Status: ${error.status} (${typeof error.status}), Message: ${error.message}`);

                // Check multiple ways a 429 might appear
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
                    // Wait for 20 seconds
                    await new Promise(resolve => setTimeout(resolve, 20000));
                    continue;
                }

                console.error("Error generating content:", error);
                if (error.message?.includes("404")) {
                    console.error("Model not found. Please check if 'models/gemini-2.5-flash' is available for your API key.");
                }
                throw error;
            }
        }
    },

    /**
     * Analiza cotizaciones usando texto extraído (NO File API)
     * Esto reduce significativamente el consumo de tokens (~66% menos)
     */
    analyzeQuotesFromText: async (quotesText: string, clausesText: string, prompt: string, schema: any) => {
        let retries = 0;
        const maxRetries = 3;

        // Log input size for monitoring
        const totalInputChars = quotesText.length + clausesText.length + prompt.length;
        console.log(`📊 Text-based analysis: ${totalInputChars} chars (~${Math.round(totalInputChars / 4)} tokens estimate)`);

        while (true) {
            try {
                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        temperature: 0,
                        topP: 0,
                        topK: 1,
                    }
                });

                // Build the content parts as text (no file uploads)
                const contentParts = [
                    { text: prompt },
                    { text: `\n\n--- COTIZACIONES ---\n\n${quotesText}` },
                ];

                // Only add clauses if provided
                if (clausesText && clausesText.trim().length > 0) {
                    contentParts.push({ text: `\n\n--- CLAUSULADOS DE REFERENCIA ---\n\n${clausesText}` });
                }

                console.log(`Generating content with model: models/gemini-2.5-flash (text mode, ${contentParts.length} parts)`);
                const result = await model.generateContent(contentParts);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const text = response.text();
                if (!text) {
                    throw new Error("Empty text response from Gemini");
                }

                console.log("✅ Gemini text-based analysis successful and parsed.");
                const parsed = JSON.parse(text);
                // Validar y completar coberturas
                return validateAnalysis(parsed);
            } catch (error: any) {
                console.log(`Debug Error Analysis - Status: ${error.status} (${typeof error.status}), Message: ${error.message}`);

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
                if (error.message?.includes("404")) {
                    console.error("Model not found. Please check if 'models/gemini-2.5-flash' is available for your API key.");
                }
                throw error;
            }
        }
    }
};
