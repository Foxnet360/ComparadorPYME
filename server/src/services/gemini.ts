import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from 'fs';
import { ClauseDocument } from '../types';
import { validateAnalysis } from '../utils/analysisValidator';
import { optimizeContextForAnalysis } from './contextOptimizer';

/**
 * Extrae y limpia JSON de la respuesta de Gemini.
 * Elimina bloques markdown, comas finales, y repara JSON truncado.
 */
function cleanJsonResponse(raw: string): string {
    let text = raw.trim();

    // Extraer de bloque markdown si existe
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        text = codeBlockMatch[1].trim();
    }

    // Eliminar comas finales antes de } o ]
    text = text.replace(/,\s*([}\]])/g, '$1');

    // Intentar reparar JSON truncado
    text = repairTruncatedJson(text);

    return text;
}

/**
 * Cuenta llaves o corchetes que NO estén dentro de strings JSON.
 * Esto evita contar { o } que aparezcan dentro de valores de texto.
 */
function countStructuralChars(text: string, char: '{' | '}' | '[' | ']'): number {
    let count = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (c === '\\') {
            escaped = true;
            continue;
        }
        
        if (c === '"' && !inString) {
            inString = true;
        } else if (c === '"' && inString) {
            inString = false;
        } else if (!inString && c === char) {
            count++;
        }
    }
    
    return count;
}

/**
 * Intenta reparar JSON truncado por límite de tokens.
 * Cierra strings, objetos y arrays abiertos de forma segura.
 */
function repairTruncatedJson(text: string): string {
    let repaired = text.trim();
    
    // Si ya es JSON válido, no tocar
    try {
        JSON.parse(repaired);
        return repaired;
    } catch {
        // Continuar con reparación
    }

    // Paso 1: Si termina en medio de un string, cerrarlo
    // Encontrar la última comilla que NO esté escapada
    let lastUnescapedQuote = -1;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (c === '\\') {
            escaped = true;
            continue;
        }
        if (c === '"') {
            inString = !inString;
            if (!inString) lastUnescapedQuote = i;
        }
    }
    
    // Si terminamos dentro de un string
    if (inString) {
        repaired += '"';
    }

    // Paso 2: Balancear llaves y corchetes (solo estructurales, no dentro de strings)
    const openBraces = countStructuralChars(repaired, '{');
    const closeBraces = countStructuralChars(repaired, '}');
    const openBrackets = countStructuralChars(repaired, '[');
    const closeBrackets = countStructuralChars(repaired, ']');
    
    // Cerrar arrays primero, luego objetos
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
    }

    // Paso 3: Si terminamos en una propiedad incompleta, eliminarla
    // Buscar el último ',' seguido de '"key":' sin valor
    const lastComma = repaired.lastIndexOf(',');
    if (lastComma > 0) {
        const afterComma = repaired.substring(lastComma + 1).trim();
        // Patrón: "propiedad":  o "propiedad":{
        if (afterComma.match(/^"[^"]*"\s*:\s*$/)) {
            repaired = repaired.substring(0, lastComma);
            // Rebalancear recursivamente
            return repairTruncatedJson(repaired);
        }
    }

    // Verificar si ahora es válido
    try {
        JSON.parse(repaired);
        return repaired;
    } catch {
        // Si aún no es válido, intentar truncar al último objeto/array completo
        const lastComplete = findLastCompleteObject(repaired);
        if (lastComplete && lastComplete.length > 10) {
            return lastComplete;
        }
    }

    return repaired;
}

/**
 * Encuentra el último objeto o array JSON completo en el texto.
 * Útil cuando todo lo demás falla.
 */
function findLastCompleteObject(text: string): string | null {
    // Buscar el último '}' o ']' que cierre correctamente
    for (let i = text.length - 1; i > 0; i--) {
        if (text[i] === '}' || text[i] === ']') {
            const candidate = text.substring(0, i + 1);
            try {
                JSON.parse(candidate);
                return candidate;
            } catch {
                continue;
            }
        }
    }
    return null;
}

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

                const result = await model.generateContent([
                    ...fileParts,
                    { text: prompt }
                ]);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const text = response.text();
                if (!text) {
                    throw new Error("Empty text response from Gemini");
                }

                const parsed = JSON.parse(cleanJsonResponse(text));
                // Validar y completar coberturas
                return validateAnalysis(parsed);
            } catch (error: any) {
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
     * 
     * Estrategia de optimización:
     * 1. Si el contexto es muy largo, lo comprime preservando estructura crítica
     * 2. maxOutputTokens aumentado a 8192 para respuestas completas
     * 3. Si falla por truncamiento, reintenta con contexto más reducido
     */
    analyzeQuotesFromText: async (quotesText: string, clausesText: string, prompt: string, schema: any, fallbackSchema?: any) => {
        let retries = 0;
        const maxRetries = 3;
        let optimizationLevel = 0; // 0: sin optimizar, 1: normal, 2: agresivo
        let useFallbackSchema = false;

        while (true) {
            try {
                // Optimizar contexto según el nivel
                let optimizedQuotes = quotesText;
                let optimizedClauses = clausesText;
                
                if (optimizationLevel > 0) {
                    const opts = optimizationLevel === 1 
                        ? { maxTotalLength: 150000 }  // Primera optimización
                        : { maxTotalLength: 100000 }; // Optimización agresiva
                    
                    const optimized = optimizeContextForAnalysis(quotesText, clausesText, opts);
                    optimizedQuotes = optimized.quotesText;
                    optimizedClauses = optimized.clausesText;
                }

                const currentSchema = useFallbackSchema && fallbackSchema ? fallbackSchema : schema;
                
                if (useFallbackSchema) {
                    console.log(`🔄 [Gemini] Usando schema simplificado (fallback)...`);
                }

                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        temperature: 0,
                        topP: 0,
                        topK: 1,
                        maxOutputTokens: 8192,  // Máximo permitido para respuestas completas
                    }
                });

                // Build the content parts as text (no file uploads)
                const contentParts = [
                    { text: prompt },
                    { text: `\n\n--- COTIZACIONES ---\n\n${optimizedQuotes}` },
                ];

                // Only add clauses if provided
                if (optimizedClauses && optimizedClauses.trim().length > 0) {
                    contentParts.push({ text: `\n\n--- CLAUSULADOS DE REFERENCIA ---\n\n${optimizedClauses}` });
                }

                const result = await model.generateContent(contentParts);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const text = response.text();
                if (!text) {
                    throw new Error("Empty text response from Gemini");
                }

                // Log para debuggear problemas de JSON
                console.log(`📄 [Gemini] Raw response length: ${text.length} chars`);
                if (text.length < 500) {
                    console.log(`📄 [Gemini] Full response: ${text}`);
                } else {
                    console.log(`📄 [Gemini] First 300 chars: ${text.substring(0, 300)}`);
                    console.log(`📄 [Gemini] Last 300 chars: ${text.substring(text.length - 300)}`);
                }

                const cleaned = cleanJsonResponse(text);
                
                try {
                    const parsed = JSON.parse(cleaned);
                    // Validar y completar coberturas
                    return validateAnalysis(parsed);
                } catch (parseError: any) {
                    console.error(`❌ [Gemini] JSON Parse Error: ${parseError.message}`);
                    console.error(`❌ [Gemini] Cleaned response (last 500 chars): ${cleaned.substring(Math.max(0, cleaned.length - 500))}`);
                    throw parseError;
                }
            } catch (error: any) {
                const errorMessage = error.message || '';
                
                // Detectar si es error de truncamiento/JSON malformado
                const isTruncationError = 
                    errorMessage.includes("Unterminated string") ||
                    errorMessage.includes("Unexpected end") ||
                    errorMessage.includes("Unexpected token") ||
                    (errorMessage.includes("JSON") && errorMessage.includes("position"));
                
                // Estrategia de fallback progresivo:
                // 1. Primero intentar optimizar el contexto (niveles 1 y 2)
                // 2. Luego intentar con schema simplificado
                // 3. Finalmente, lanzar error
                if (isTruncationError) {
                    if (optimizationLevel < 2) {
                        optimizationLevel++;
                        console.log(`⚠️ Respuesta truncada detectada. Reintentando con optimización nivel ${optimizationLevel}...`);
                        continue;
                    } else if (fallbackSchema && !useFallbackSchema) {
                        useFallbackSchema = true;
                        optimizationLevel = 0; // Reset optimización para intentar con schema simple
                        console.log(`⚠️ Respuesta truncada detectada. Reintentando con schema simplificado...`);
                        continue;
                    }
                }

                const isRateLimit =
                    error.status === 429 ||
                    error.status === '429' ||
                    errorMessage.includes("429") ||
                    errorMessage.includes("Quota exceeded") ||
                    errorMessage.includes("Too Many Requests");

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
                if (errorMessage.includes("404")) {
                    console.error("Model not found. Please check if 'models/gemini-2.5-flash' is available for your API key.");
                }
                throw error;
            }
        }
    }
};
