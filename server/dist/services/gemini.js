"use strict";
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
exports.geminiService = exports.QuoteExtractionSchema = void 0;
const generative_ai_1 = require("@google/generative-ai");
const server_1 = require("@google/generative-ai/server");
const textPreprocessor_1 = require("./textPreprocessor");
const jsonRepair_1 = require("./jsonRepair");
const premiumExtractor_1 = require("./premiumExtractor");
/**
 * JSON Schema for structured quote extraction
 * Enforces consistent output format from Gemini
 */
exports.QuoteExtractionSchema = {
    description: "Extracted insurance quote data",
    type: "object",
    properties: {
        insurerName: {
            type: "string",
            description: "Name of the insurance company",
            nullable: false,
        },
        policyName: {
            type: "string",
            description: "Name of the insurance product/policy",
            nullable: false,
        },
        priceAnnual: {
            type: "number",
            description: "Annual premium amount in numeric format",
            nullable: false,
        },
        currency: {
            type: "string",
            description: "Currency code",
            enum: ["COP", "USD"],
            nullable: false,
        },
        validityPeriod: {
            type: "string",
            description: "Policy validity period (e.g., '2024-01-01 - 2024-12-31')",
            nullable: true,
        },
        coverages: {
            type: "array",
            description: "List of coverage items found in the document. Extract ALL coverages you find, even if the name doesn't match exactly the canonical list.",
            items: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Coverage name EXACTLY as it appears in the document. Do NOT modify or translate the name. Copy it verbatim from the PDF.",
                        nullable: false,
                    },
                    value: {
                        type: "string",
                        description: "Insured amount (number) or description. Use the exact value from the document.",
                        nullable: false,
                    },
                    deductible: {
                        type: "string",
                        description: "Deductible value EXACTLY as it appears in the document (e.g., '10%', '5 SMMLV', 'No aplica', 'APLICA'). Copy verbatim.",
                        nullable: false,
                    },
                },
                required: ["name", "value", "deductible"],
            },
        },
        specialConditions: {
            type: "array",
            description: "Special conditions or clauses",
            items: {
                type: "string",
            },
        },
        expectedCoverages: {
            type: "array",
            description: "List of all 14 expected PYME coverages with their status",
            items: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Canonical coverage name from the 14 PYME template",
                        nullable: false,
                    },
                    status: {
                        type: "string",
                        description: "Whether this coverage is present, missing, or excluded",
                        enum: ["present", "missing", "excluded"],
                        nullable: false,
                    },
                    value: {
                        type: "string",
                        description: "Insured amount if present, or reason if excluded",
                        nullable: true,
                    },
                    deductible: {
                        type: "string",
                        description: "Deductible if present",
                        nullable: true,
                    },
                },
                required: ["name", "status"],
            },
        },
    },
    required: ["insurerName", "policyName", "priceAnnual", "currency", "coverages", "expectedCoverages"],
};
// Initialize Gemini lazily
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment");
    }
    return new generative_ai_1.GoogleGenerativeAI(apiKey);
};
const getFileManager = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment");
    }
    return new server_1.GoogleAIFileManager(apiKey);
};
/**
 * Build optimized text from clause sections (not full text)
 * This reduces token usage by ~80% compared to full clause text
 */
const buildSectionText = (clauses) => {
    if (clauses.length === 0)
        return '';
    const parts = [];
    for (const clause of clauses) {
        const { aseguradora, producto, version, secciones, textoCompleto } = clause;
        parts.push(`\n=== ${aseguradora} - ${producto} (${version}) ===`);
        // Use sections if available, otherwise fallback to full text
        if ((secciones === null || secciones === void 0 ? void 0 : secciones.exclusiones) || (secciones === null || secciones === void 0 ? void 0 : secciones.deducibles) || (secciones === null || secciones === void 0 ? void 0 : secciones.garantias)) {
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
        }
        else {
            // Fallback to full text if no sections extracted
            parts.push('\n[CLAUSULADO COMPLETO - Secciones no extraídas]');
            parts.push(textoCompleto);
        }
        parts.push('===\n');
    }
    return parts.join('\n');
};
exports.geminiService = {
    // Export buildSectionText for use in controller
    buildSectionText,
    uploadFile: (filePath, mimeType, displayName) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const fileManager = getFileManager();
            const uploadResult = yield fileManager.uploadFile(filePath, {
                mimeType,
                displayName,
            });
            return uploadResult.file;
        }
        catch (error) {
            console.error("Error uploading to Gemini:", error);
            throw error;
        }
    }),
    waitForFilesActive: (files) => __awaiter(void 0, void 0, void 0, function* () {
        const fileManager = getFileManager();
        for (const name of files.map((file) => file.name)) {
            let file = yield fileManager.getFile(name);
            while (file.state === server_1.FileState.PROCESSING) {
                yield new Promise((resolve) => setTimeout(resolve, 2000));
                file = yield fileManager.getFile(name);
            }
            if (file.state !== server_1.FileState.ACTIVE) {
                throw new Error(`File ${file.name} failed to process`);
            }
        }
    }),
    /**
     * Generates content using Gemini with free-text output (NO JSON schema forcing)
     *
     * @deprecated Use extractStructured() instead for better reliability and type safety
     * @param text - The text to analyze
     * @param prompt - The extraction prompt
     * @returns Raw text response from Gemini
     */
    extractText: (text, prompt) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        let retries = 0;
        const maxRetries = 3;
        while (true) {
            try {
                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 32768,
                    }
                });
                const result = yield model.generateContent([
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
            }
            catch (error) {
                const isRateLimit = error.status === 429 ||
                    error.status === '429' ||
                    ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("429")) ||
                    ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("Quota exceeded")) ||
                    ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("Too Many Requests"));
                if (isRateLimit) {
                    console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries}...`);
                    if (retries >= maxRetries) {
                        console.error("Max retries exceeded for rate limit.");
                        throw error;
                    }
                    retries++;
                    yield new Promise(resolve => setTimeout(resolve, 20000));
                    continue;
                }
                console.error("Error generating content:", error);
                throw error;
            }
        }
    }),
    /**
     * Extract structured quote data using Gemini JSON mode
     * Returns a typed object conforming to QuoteExtractionSchema
     *
     * @param text - The text to analyze
     * @param prompt - The extraction prompt with few-shot examples
     * @returns Structured quote data
     */
    extractStructured: (text_1, prompt_1, ...args_1) => __awaiter(void 0, [text_1, prompt_1, ...args_1], void 0, function* (text, prompt, pageCount = 1) {
        var _a, _b, _c, _d, _e, _f;
        let retries = 0;
        const maxRetries = 3;
        // Pre-process text before extraction
        const preprocessed = (0, textPreprocessor_1.preprocessText)(text, pageCount);
        if (preprocessed.metadata.changes.length > 0) {
            console.log(`🧹 [PreProcessor] Changes: ${preprocessed.metadata.changes.join(', ')}`);
        }
        while (true) {
            try {
                const genAI = getGenAI();
                const model = genAI.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 32768,
                        responseMimeType: 'application/json',
                        responseSchema: exports.QuoteExtractionSchema,
                    }
                });
                const result = yield model.generateContent([
                    { text: prompt },
                    { text: `\n\n--- DOCUMENTO ---\n\n${preprocessed.text}` }
                ]);
                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }
                const responseText = response.text();
                if (!responseText) {
                    throw new Error("Empty response from Gemini");
                }
                // Try to parse with automatic repair
                const parseResult = (0, jsonRepair_1.parseJsonWithRepair)(responseText);
                if (parseResult.success) {
                    if (parseResult.wasRepaired) {
                        console.log(`🔧 [JSON Repair] Fixed using ${parseResult.repairType}`);
                    }
                    const data = parseResult.data;
                    // Try premium extraction fallback if priceAnnual is 0 or missing
                    if (!data.priceAnnual || data.priceAnnual === 0) {
                        console.log(`💰 [Premium] Structured extraction returned 0, trying regex fallback...`);
                        const premiumResult = (0, premiumExtractor_1.extractAndValidatePremium)(0, preprocessed.text);
                        if (premiumResult.priceAnnual > 0) {
                            data.priceAnnual = premiumResult.priceAnnual;
                            data.currency = premiumResult.currency;
                            data.premiumSource = premiumResult.source;
                            data.premiumConfidence = premiumResult.confidence;
                            console.log(`💰 [Premium] Found via ${premiumResult.source}: ${premiumResult.priceAnnual} ${premiumResult.currency}`);
                        }
                        else {
                            data.premiumSource = 'unknown';
                            data.premiumConfidence = 0;
                        }
                    }
                    else {
                        data.premiumSource = 'structured';
                        data.premiumConfidence = 95;
                    }
                    console.log(`📄 [Gemini] Structured extraction: ${data.insurerName}, ${((_a = data.coverages) === null || _a === void 0 ? void 0 : _a.length) || 0} coverages, premium: ${data.priceAnnual || 0}`);
                    return data;
                }
                else {
                    throw new Error(`JSON parsing failed: ${parseResult.error}`);
                }
            }
            catch (error) {
                const isRateLimit = error.status === 429 ||
                    error.status === '429' ||
                    ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes("429")) ||
                    ((_c = error.message) === null || _c === void 0 ? void 0 : _c.includes("Quota exceeded")) ||
                    ((_d = error.message) === null || _d === void 0 ? void 0 : _d.includes("Too Many Requests"));
                if (isRateLimit) {
                    console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries}...`);
                    if (retries >= maxRetries) {
                        console.error("Max retries exceeded for rate limit.");
                        throw error;
                    }
                    retries++;
                    yield new Promise(resolve => setTimeout(resolve, 20000));
                    continue;
                }
                // If JSON parsing fails or schema validation fails, throw
                if (((_e = error.message) === null || _e === void 0 ? void 0 : _e.includes("JSON")) || ((_f = error.message) === null || _f === void 0 ? void 0 : _f.includes("schema"))) {
                    console.error("❌ [Gemini] Structured extraction failed:", error.message);
                    throw new Error(`Structured extraction failed: ${error.message}`);
                }
                console.error("Error generating structured content:", error);
                throw error;
            }
        }
    }),
    /**
     * Generate narrative text (recommendation, analysis) using Gemini
     * This is the only place where we use Gemini for text generation
     */
    generateNarrative: (analysisData) => __awaiter(void 0, void 0, void 0, function* () {
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
        const text = yield exports.geminiService.extractText('', prompt);
        // Simple parsing of the response
        const recMatch = text.match(/RECOMENDACI[ÓO]N:\s*([\s\S]*?)(?=AN[ÁA]LISIS|$)/i);
        const marketMatch = text.match(/AN[ÁA]LISIS\s+DE\s+MERCADO:\s*([\s\S]*)/i);
        return {
            recommendation: recMatch ? recMatch[1].trim().substring(0, 1500) : 'No se pudo generar recomendación',
            marketAnalysis: marketMatch ? marketMatch[1].trim().substring(0, 1500) : 'No se pudo generar análisis'
        };
    })
};
