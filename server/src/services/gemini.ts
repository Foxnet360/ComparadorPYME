import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import fs from 'fs';
import { ClauseDocument } from '../types';
import { preprocessText } from './textPreprocessor';
import { parseJsonWithRepair } from './jsonRepair';
import { extractAndValidatePremium, createPremiumPrompt } from './premiumExtractor';

/**
 * JSON Schema V2 for flexible quote extraction
 * Captures raw document structure without forcing 14 canonical coverages
 */
export const QuoteExtractionSchemaV2: any = {
  description: "Extracted insurance quote data with flexible structure",
  type: SchemaType.OBJECT,
  properties: {
    insurerName: {
      type: SchemaType.STRING,
      description: "Name of the insurance company",
      nullable: false,
    },
    policyName: {
      type: SchemaType.STRING,
      description: "Name of the insurance product/policy",
      nullable: false,
    },
    validityPeriod: {
      type: SchemaType.STRING,
      description: "Policy validity period",
      nullable: true,
    },
    premium: {
      type: SchemaType.OBJECT,
      description: "Premium breakdown",
      properties: {
        netPremium: { type: SchemaType.NUMBER, description: "Net premium amount" },
        fees: { type: SchemaType.NUMBER, description: "Expedition fees" },
        taxes: { type: SchemaType.NUMBER, description: "Taxes (IVA)" },
        otherCharges: { type: SchemaType.NUMBER, description: "Other charges (assistance, digital emission, etc.)" },
        totalPayable: { type: SchemaType.NUMBER, description: "Total amount to pay" },
        currency: { type: SchemaType.STRING, description: "Currency code" },
        periodicity: { type: SchemaType.STRING, description: "Payment periodicity" },
      },
      required: ["totalPayable", "currency"],
    },
    insuredAssets: {
      type: SchemaType.ARRAY,
      description: "Insurable assets from the quote",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          assetType: { type: SchemaType.STRING, description: "Type of asset (e.g., EDIFICIOS, CONTENIDOS)" },
          value: { type: SchemaType.NUMBER, description: "Insured value" },
          notes: { type: SchemaType.STRING, nullable: true },
        },
      },
    },
    rawCoverages: {
      type: SchemaType.ARRAY,
      description: "Coverages as they appear in the document",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          section: { type: SchemaType.STRING, description: "Section name (e.g., DAÑOS MATERIALES)", nullable: true },
          rawName: { type: SchemaType.STRING, description: "Exact coverage name from document" },
          insuredAmount: { type: SchemaType.NUMBER, description: "Insured amount", nullable: true },
          deductible: { type: SchemaType.STRING, description: "Deductible text as appears", nullable: true },
          premium: { type: SchemaType.NUMBER, description: "Premium for this coverage", nullable: true },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ["rawName"],
      },
    },
    subLimits: {
      type: SchemaType.ARRAY,
      description: "Sub-limits separated from main coverages",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          parentCoverage: { type: SchemaType.STRING, description: "Parent coverage name" },
          name: { type: SchemaType.STRING, description: "Sub-limit name" },
          limit: { type: SchemaType.NUMBER, description: "Sub-limit amount" },
          deductible: { type: SchemaType.STRING, nullable: true },
        },
        required: ["parentCoverage", "name", "limit"],
      },
    },
    generalDeductibles: {
      type: SchemaType.ARRAY,
      description: "General deductibles by section/type",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          appliesTo: { type: SchemaType.STRING, description: "What this deductible applies to" },
          deductibleText: { type: SchemaType.STRING, description: "Deductible text" },
        },
        required: ["appliesTo", "deductibleText"],
      },
    },
    specialConditions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    exclusions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    warranties: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
  },
  required: ["insurerName", "policyName", "premium", "rawCoverages"],
};

/**
 * JSON Schema for structured quote extraction (Legacy V1)
 * Enforces consistent output format from Gemini
 * @deprecated Use QuoteExtractionSchemaV2 for flexible extraction
 */
export const QuoteExtractionSchema: any = {
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

    deleteFile: async (fileName: string) => {
        try {
            const fileManager = getFileManager();
            await fileManager.deleteFile(fileName);
            console.log(`🗑️ [Gemini] Deleted file: ${fileName}`);
        } catch (error: any) {
            console.warn(`⚠️ [Gemini] Failed to delete file ${fileName}:`, error.message);
        }
    },

    /**
     * Extract structured data from PDF using multimodal vision
     * Uploads PDF to Gemini File API and processes with vision
     */
    extractFromPdfWithVision: async (
        pdfPath: string,
        prompt: string,
        filename: string
    ): Promise<any> => {
        let uploadedFile: any = null;
        let retries = 0;
        const maxRetries = 3;

        while (true) {
            try {
                console.log(`📤 [Gemini] Uploading PDF: ${filename}`);
                
                // Upload PDF
                uploadedFile = await geminiService.uploadFile(
                    pdfPath,
                    'application/pdf',
                    filename
                );

                // Wait for processing
                console.log(`⏳ [Gemini] Waiting for file processing...`);
                await geminiService.waitForFilesActive([uploadedFile]);
                console.log(`✅ [Gemini] File ready: ${uploadedFile.name}`);

                // Extract using multimodal model
                const genAI = getGenAI();
                const extractionModel = process.env.GEMINI_MODEL 
                    ? `models/${process.env.GEMINI_MODEL}`
                    : 'models/gemini-2.5-pro';
                
                console.log(`🤖 [Gemini] Using model: ${extractionModel} for PDF extraction`);
                
                const model = genAI.getGenerativeModel({
                    model: extractionModel,
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 32768,
                        responseMimeType: 'application/json',
                        responseSchema: QuoteExtractionSchemaV2,
                    }
                });

                const result = await model.generateContent([
                    { text: prompt },
                    {
                        fileData: {
                            fileUri: uploadedFile.uri,
                            mimeType: 'application/pdf',
                        }
                    }
                ]);

                const response = result.response;
                if (!response) {
                    throw new Error("No response received from Gemini");
                }

                const responseText = response.text();
                if (!responseText) {
                    throw new Error("Empty response from Gemini");
                }

                // Parse JSON
                const parseResult = parseJsonWithRepair(responseText);
                
                if (parseResult.success) {
                    console.log(`📄 [Gemini] PDF extraction: ${parseResult.data.insurerName}, ${parseResult.data.rawCoverages?.length || 0} coverages`);
                    return parseResult.data;
                } else {
                    throw new Error(`JSON parsing failed: ${parseResult.error}`);
                }

            } catch (error: any) {
                const isRateLimit =
                    error.status === 429 ||
                    error.status === '429' ||
                    error.message?.includes("429") ||
                    error.message?.includes("Quota exceeded") ||
                    error.message?.includes("Too Many Requests");

                if (isRateLimit) {
                    const backoffMs = Math.min(20000 * Math.pow(2, retries), 120000);
                    console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries} (backoff: ${backoffMs}ms)...`);
                    if (retries >= maxRetries) {
                        console.error("Max retries exceeded for rate limit.");
                        throw error;
                    }
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    continue;
                }

                console.error("❌ [Gemini] PDF extraction failed:", error);
                throw error;
            } finally {
                // Always cleanup uploaded file
                if (uploadedFile?.name) {
                    await geminiService.deleteFile(uploadedFile.name);
                }
            }
        }
    },

    /**
     * Retry wrapper with exponential backoff for any async function
     */
    withRetry: async <T>(
        fn: () => Promise<T>,
        options: {
            maxRetries?: number;
            baseDelay?: number;
            maxDelay?: number;
            shouldRetry?: (error: any) => boolean;
        } = {}
    ): Promise<T> => {
        const {
            maxRetries = 3,
            baseDelay = 2000,
            maxDelay = 120000,
            shouldRetry = (error: any) => {
                return error.status === 429 ||
                    error.status === '429' ||
                    error.message?.includes("429") ||
                    error.message?.includes("Quota exceeded") ||
                    error.message?.includes("Too Many Requests");
            }
        } = options;

        let retries = 0;
        while (true) {
            try {
                return await fn();
            } catch (error: any) {
                if (!shouldRetry(error) || retries >= maxRetries) {
                    throw error;
                }
                
                const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
                console.log(`🔄 [Retry] Attempt ${retries + 1}/${maxRetries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            }
        }
    },

    /**
     * Generates content using Gemini with free-text output (NO JSON schema forcing)
     * 
     * @deprecated Use extractStructured() instead for better reliability and type safety
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
                        maxOutputTokens: 32768,
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
     * Extract structured quote data using Gemini JSON mode
     * Returns a typed object conforming to QuoteExtractionSchema
     * 
     * @param text - The text to analyze
     * @param prompt - The extraction prompt with few-shot examples
     * @returns Structured quote data
     */
    extractStructured: async (text: string, prompt: string, pageCount: number = 1): Promise<any> => {
        let retries = 0;
        const maxRetries = 3;

        // Pre-process text before extraction
        const preprocessed = preprocessText(text, pageCount);
        if (preprocessed.metadata.changes.length > 0) {
            console.log(`🧹 [PreProcessor] Changes: ${preprocessed.metadata.changes.join(', ')}`);
        }

        while (true) {
            try {
                const genAI = getGenAI();
                const extractionModel = process.env.GEMINI_MODEL 
                    ? `models/${process.env.GEMINI_MODEL}`
                    : 'models/gemini-2.5-flash';
                console.log(`🤖 [Gemini] Using model: ${extractionModel} for extraction`);
                const model = genAI.getGenerativeModel({
                    model: extractionModel,
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 32768,
                        responseMimeType: 'application/json',
                        responseSchema: QuoteExtractionSchema,
                    }
                });

                const result = await model.generateContent([
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
                const parseResult = parseJsonWithRepair(responseText);
                
                if (parseResult.success) {
                    if (parseResult.wasRepaired) {
                        console.log(`🔧 [JSON Repair] Fixed using ${parseResult.repairType}`);
                    }
                    
                    const data = parseResult.data;
                    
                    // Try premium extraction fallback if priceAnnual is 0 or missing
                    if (!data.priceAnnual || data.priceAnnual === 0) {
                        console.log(`💰 [Premium] Structured extraction returned 0, trying regex fallback...`);
                        const premiumResult = extractAndValidatePremium(0, preprocessed.text);
                        
                        if (premiumResult.priceAnnual > 0) {
                            data.priceAnnual = premiumResult.priceAnnual;
                            data.currency = premiumResult.currency;
                            data.premiumSource = premiumResult.source;
                            data.premiumConfidence = premiumResult.confidence;
                            console.log(`💰 [Premium] Found via ${premiumResult.source}: ${premiumResult.priceAnnual} ${premiumResult.currency}`);
                        } else {
                            data.premiumSource = 'unknown';
                            data.premiumConfidence = 0;
                        }
                    } else {
                        data.premiumSource = 'structured';
                        data.premiumConfidence = 95;
                    }
                    
                    console.log(`📄 [Gemini] Structured extraction: ${data.insurerName}, ${data.coverages?.length || 0} coverages, premium: ${data.priceAnnual || 0}`);
                    return data;
                } else {
                    throw new Error(`JSON parsing failed: ${parseResult.error}`);
                }
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

                // If JSON parsing fails or schema validation fails, throw
                if (error.message?.includes("JSON") || error.message?.includes("schema")) {
                    console.error("❌ [Gemini] Structured extraction failed:", error.message);
                    throw new Error(`Structured extraction failed: ${error.message}`);
                }

                console.error("Error generating structured content:", error);
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