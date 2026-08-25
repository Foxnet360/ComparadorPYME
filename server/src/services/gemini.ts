import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
const SchemaType = Type;

import { ClauseDocument } from '../types';
import { featureFlags } from '../config/featureFlags';
import { preprocessText } from './textPreprocessor';
import { parseJsonWithRepair } from './jsonRepair';
import { extractAndValidatePremium } from './premiumExtractor';
import {
  validateQuoteExtractionV2,
  validateQuoteExtraction,
  validateDeductibleStructure,
  formatZodError,
  QuoteExtractionV2,
  QuoteExtraction,
  DeductibleStructure,
} from '../schemas/extractionSchemas';
import {
  GeminiInvalidResponseError,
  categorizeGeminiError,
  GeminiRateLimitError,
  GeminiServiceUnavailableError,
} from '../errors/geminiErrors';

/**
 * JSON Schema V2 for flexible quote extraction
 * Captures raw document structure without forcing 14 canonical coverages
 */
export const QuoteExtractionSchemaV2 = {
  description: 'Extracted insurance quote data with flexible structure',
  type: SchemaType.OBJECT,
  properties: {
    insurerName: {
      type: SchemaType.STRING,
      description: 'Name of the insurance company',
      nullable: false,
    },
    policyName: {
      type: SchemaType.STRING,
      description: 'Name of the insurance product/policy',
      nullable: false,
    },
    validityPeriod: {
      type: SchemaType.STRING,
      description: 'Policy validity period',
      nullable: true,
    },
    formatFamily: {
      type: SchemaType.STRING,
      description: 'Detected format family of the quote (e.g. TABLE-DOUBLE, SECTIONS)',
      nullable: false,
    },
    premium: {
      type: SchemaType.OBJECT,
      description: 'Premium breakdown',
      properties: {
        netPremium: { type: SchemaType.NUMBER, description: 'Net premium amount' },
        fees: { type: SchemaType.NUMBER, description: 'Expedition fees' },
        taxes: { type: SchemaType.NUMBER, description: 'Taxes (IVA)' },
        otherCharges: {
          type: SchemaType.NUMBER,
          description: 'Other charges (assistance, digital emission, etc.)',
        },
        totalPayable: { type: SchemaType.NUMBER, description: 'Total amount to pay' },
        currency: { type: SchemaType.STRING, description: 'Currency code' },
        periodicity: { type: SchemaType.STRING, description: 'Payment periodicity' },
      },
      required: ['totalPayable', 'currency'],
    },
    insuredAssets: {
      type: SchemaType.ARRAY,
      description: 'Insurable assets from the quote',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          assetType: {
            type: SchemaType.STRING,
            description: 'Type of asset (e.g., EDIFICIOS, CONTENIDOS)',
          },
          value: { type: SchemaType.NUMBER, description: 'Insured value' },
          notes: { type: SchemaType.STRING, nullable: true },
        },
      },
    },
    rawCoverages: {
      type: SchemaType.ARRAY,
      description: 'Coverages as they appear in the document',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          section: {
            type: SchemaType.STRING,
            description: 'Section name (e.g., DAÑOS MATERIALES)',
            nullable: true,
          },
          rawName: { type: SchemaType.STRING, description: 'Exact coverage name from document' },
          insuredAmount: { type: SchemaType.NUMBER, description: 'Insured amount', nullable: true },
          deductible: {
            type: SchemaType.STRING,
            description:
              'Deductible text as it appears in the document. If the coverage has no deductible, use null. If not found in the main table, search ALL pages including clauses, conditions, and annexes.',
            nullable: true,
          },
          rawTextSnippet: {
            type: SchemaType.STRING,
            description:
              'Exact contiguous text snippet (50-300 chars) from the PDF where this coverage, sub-limit or clause appears. Must be verifiable in native text.',
            nullable: false,
          },
          pageNumber: {
            type: SchemaType.NUMBER,
            description: '1-based PDF page number where rawTextSnippet appears.',
            nullable: false,
          },
          premium: {
            type: SchemaType.NUMBER,
            description: 'Premium for this coverage',
            nullable: true,
          },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ['rawName', 'rawTextSnippet', 'pageNumber'],
      },
    },
    subLimits: {
      type: SchemaType.ARRAY,
      description: 'Sub-limits separated from main coverages',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          parentCoverage: { type: SchemaType.STRING, description: 'Parent coverage name' },
          name: { type: SchemaType.STRING, description: 'Sub-limit name' },
          limit: { type: SchemaType.NUMBER, description: 'Sub-limit amount' },
          deductible: { type: SchemaType.STRING, nullable: true },
        },
        required: ['parentCoverage', 'name', 'limit'],
      },
    },
    generalDeductibles: {
      type: SchemaType.ARRAY,
      description: 'General deductibles by section/type',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          appliesTo: { type: SchemaType.STRING, description: 'What this deductible applies to' },
          deductibleText: { type: SchemaType.STRING, description: 'Deductible text' },
        },
        required: ['appliesTo', 'deductibleText'],
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
  required: ['insurerName', 'policyName', 'formatFamily', 'premium', 'rawCoverages'],
} as const;

export const DeductibleSchema = {
  description: 'Estructura detallada de un deducible de seguros',
  type: SchemaType.OBJECT,
  properties: {
    components: {
      type: SchemaType.ARRAY,
      description: 'Componentes del deducible',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            description: 'Tipo de componente',
            enum: ['percentage', 'fixed', 'smmlv', 'uvt', 'minimum', 'maximum', 'na', 'unknown'],
          },
          value: { type: SchemaType.NUMBER, description: 'Valor numérico del componente' },
          currency: {
            type: SchemaType.STRING,
            description: 'Moneda o unidad de medida (ej: COP, SMMLV, UVT)',
            nullable: true,
          },
        },
        required: ['type', 'value'],
      },
    },
    isZero: {
      type: SchemaType.BOOLEAN,
      description: 'Indica si el deducible es cero (sin deducible)',
    },
    hasMinimum: { type: SchemaType.BOOLEAN, description: 'Indica si tiene un mínimo' },
    hasMaximum: { type: SchemaType.BOOLEAN, description: 'Indica si tiene un tope o máximo' },
    isComposite: {
      type: SchemaType.BOOLEAN,
      description: 'Indica si es un deducible compuesto (ej: porcentaje con un mínimo)',
    },
  },
  required: ['components', 'isZero', 'hasMinimum', 'hasMaximum', 'isComposite'],
} as const;

/**
 * JSON Schema for structured quote extraction (Legacy V1)
 * Enforces consistent output format from Gemini
 * @deprecated Use QuoteExtractionSchemaV2 for flexible extraction
 */
export const QuoteExtractionSchema = {
  description: 'Extracted insurance quote data',
  type: 'object',
  properties: {
    insurerName: {
      type: 'string',
      description: 'Name of the insurance company',
      nullable: false,
    },
    policyName: {
      type: 'string',
      description: 'Name of the insurance product/policy',
      nullable: false,
    },
    priceAnnual: {
      type: 'number',
      description: 'Annual premium amount in numeric format',
      nullable: false,
    },
    currency: {
      type: 'string',
      description: 'Currency code',
      enum: ['COP', 'USD'],
      nullable: false,
    },
    validityPeriod: {
      type: 'string',
      description: "Policy validity period (e.g., '2024-01-01 - 2024-12-31')",
      nullable: true,
    },
    coverages: {
      type: 'array',
      description:
        "List of coverage items found in the document. Extract ALL coverages you find, even if the name doesn't match exactly the canonical list.",
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Coverage name EXACTLY as it appears in the document. Do NOT modify or translate the name. Copy it verbatim from the PDF.',
            nullable: false,
          },
          value: {
            type: 'string',
            description:
              'Insured amount (number) or description. Use the exact value from the document.',
            nullable: false,
          },
          deductible: {
            type: 'string',
            description:
              "Deductible value EXACTLY as it appears in the document (e.g., '10%', '5 SMMLV', 'No aplica', 'APLICA'). Copy verbatim.",
            nullable: false,
          },
        },
        required: ['name', 'value', 'deductible'],
      },
    },
    specialConditions: {
      type: 'array',
      description: 'Special conditions or clauses',
      items: {
        type: 'string',
      },
    },
    expectedCoverages: {
      type: 'array',
      description: 'List of all 14 expected PYME coverages with their status',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Canonical coverage name from the 14 PYME template',
            nullable: false,
          },
          status: {
            type: 'string',
            description: 'Whether this coverage is present, missing, or excluded',
            enum: ['present', 'missing', 'excluded'],
            nullable: false,
          },
          value: {
            type: 'string',
            description: 'Insured amount if present, or reason if excluded',
            nullable: true,
          },
          deductible: {
            type: 'string',
            description: 'Deductible if present',
            nullable: true,
          },
        },
        required: ['name', 'status'],
      },
    },
  },
  required: [
    'insurerName',
    'policyName',
    'priceAnnual',
    'currency',
    'coverages',
    'expectedCoverages',
  ],
} as const;

function validateGeminiOutput<T>(
  data: unknown,
  validator: (d: unknown) => { success: true; data: T } | { success: false; error: z.ZodError },
  label: string
): T {
  const result = validator(data);
  if (!result.success) {
    throw new GeminiInvalidResponseError(
      `${label} Zod validation failed: ${formatZodError(result.error)}`
    );
  }
  return result.data;
}

function isRetryableError(error: unknown): boolean {
  const e = error as { status?: number | string; message?: string };
  return (
    e.status === 429 ||
    e.status === '429' ||
    e.status === 503 ||
    e.status === '503' ||
    !!e.message?.includes('429') ||
    !!e.message?.includes('Quota exceeded') ||
    !!e.message?.includes('Too Many Requests') ||
    !!e.message?.includes('503') ||
    !!e.message?.includes('Service Unavailable') ||
    !!e.message?.includes('high demand')
  );
}

// Initialize Gemini lazily
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  return new GoogleGenAI({ apiKey });
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

interface UploadedFile {
  name: string;
  uri: string;
  state?: string;
}

export const geminiService = {
  // Export buildSectionText for use in controller
  buildSectionText,

  uploadFile: async (
    filePath: string,
    mimeType: string,
    displayName: string
  ): Promise<UploadedFile> => {
    try {
      const ai = getGenAI();
      const uploadResult = await ai.files.upload({
        file: filePath,
        config: {
          mimeType,
          displayName,
        },
      });

      return uploadResult as UploadedFile;
    } catch (error: unknown) {
      console.error('Error uploading to Gemini:', error);
      throw error;
    }
  },

  waitForFilesActive: async (files: UploadedFile[]) => {
    const ai = getGenAI();
    for (const name of files.map((file) => file.name)) {
      let file = await ai.files.get({ name });
      while (file.state === 'PROCESSING') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        file = await ai.files.get({ name });
      }
      if (file.state !== 'ACTIVE') {
        throw new Error(`File ${file.name} failed to process`);
      }
    }
  },

  deleteFile: async (fileName: string) => {
    try {
      const ai = getGenAI();
      await ai.files.delete({ name: fileName });
      console.log(`🗑️ [Gemini] Deleted file: ${fileName}`);
    } catch (error: unknown) {
      console.warn(
        `⚠️ [Gemini] Failed to delete file ${fileName}:`,
        error instanceof Error ? error.message : error
      );
    }
  },

  getOrCreateContextCache: async (params: {
    contents: unknown[];
    model?: string;
    ttlSeconds?: number;
  }): Promise<string | null> => {
    if (!featureFlags.isEnabled('enableGeminiContextCaching')) {
      return null;
    }
    try {
      const ai = getGenAI();
      const model = params.model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const cacheConfig = {
        model,
        contents: params.contents as any,
        ttl: `${params.ttlSeconds || 3600}s`,
      };
      const cache = await (ai.caches as any).create(cacheConfig);
      console.log(`⚡ [GeminiService] Created context cache handle: ${cache.name}`);
      return cache.name || null;
    } catch (error: unknown) {
      console.warn(
        `⚠️ [GeminiService] Context cache creation failed, using fallback: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  },

  /**
   * Extract structured data from PDF using multimodal vision + native text reference
   * Uploads PDF to Gemini File API and processes with vision
   */
  extractFromPdfWithVision: async (
    pdfPath: string,
    prompt: string,
    filename: string,
    extractedText?: string,
    options?: { skipValidation?: boolean; onRepairUsed?: (category: string) => void }
  ): Promise<QuoteExtractionV2> => {
    let uploadedFile: UploadedFile | null = null;
    try {
      console.log(`📤 [Gemini] Uploading PDF: ${filename}`);

      // Upload PDF
      uploadedFile = await geminiService.uploadFile(pdfPath, 'application/pdf', filename);

      // Wait for processing
      console.log(`⏳ [Gemini] Waiting for file processing...`);
      await geminiService.waitForFilesActive([uploadedFile]);
      console.log(`✅ [Gemini] File ready: ${uploadedFile.name}`);

      const ai = getGenAI();
      const extractionModel = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

      let retries = 0;
      const maxRetries = 3;

      while (true) {
        try {
          console.log(
            `🤖 [Gemini] Using model: ${extractionModel} (High Reasoning) for PDF extraction (attempt ${retries + 1})`
          );

          let finalPrompt = prompt;
          if (extractedText && extractedText.trim().length > 0) {
            finalPrompt += `\n\n=== TEXTO EXTRAÍDO NATIVAMENTE (REFERENCIA DE ALTA FIDELIDAD) ===\n`;
            finalPrompt += `Utiliza el siguiente texto extraído del PDF como referencia exacta de caracteres para nombres de coberturas, sumas aseguradas y deducibles. Evita perder detalles en la maquetación visual:\n\n`;
            finalPrompt += `${extractedText.slice(0, 120000)}`;
          }

          const result = await ai.models.generateContent({
            model: extractionModel,
            contents: [
              { text: finalPrompt },
              {
                fileData: {
                  fileUri: uploadedFile.uri,
                  mimeType: 'application/pdf',
                },
              },
            ],
            config: {
              temperature: 0.1,
              maxOutputTokens: 65536,
              responseMimeType: 'application/json',
              responseSchema: QuoteExtractionSchemaV2 as unknown,
              thinkingConfig: {
                thinkingLevel: (process.env.GEMINI_THINKING_LEVEL || 'high') as any,
              },
            },
          });

          const responseText = result.text;
          if (!responseText) {
            throw new Error('Empty response from Gemini');
          }

          // Parse JSON and validate against Zod schema
          const parseResult = parseJsonWithRepair(responseText);

          if (parseResult.success) {
            if (options?.onRepairUsed && parseResult.wasRepaired && parseResult.repairType) {
              options.onRepairUsed(parseResult.repairType);
            }

            if (options?.skipValidation) {
              return parseResult.data as QuoteExtractionV2;
            }

            const validated = validateGeminiOutput<QuoteExtractionV2>(
              parseResult.data,
              validateQuoteExtractionV2,
              'PDF Vision'
            );
            console.log(
              `📄 [Gemini] PDF extraction: ${validated.insurerName}, ${validated.rawCoverages?.length || 0} coverages`
            );
            return validated;
          } else {
            throw new Error(`JSON parsing failed: ${parseResult.error}`);
          }
        } catch (error: unknown) {
          const geminiError = categorizeGeminiError(error);

          const isRateLimit = geminiError instanceof GeminiRateLimitError;
          const isServiceUnavailable = geminiError instanceof GeminiServiceUnavailableError;

          if (isRateLimit || isServiceUnavailable) {
            const backoffMs = Math.min(20000 * Math.pow(2, retries), 120000);
            const errorType = isRateLimit ? 'Rate limit' : 'Service unavailable (503)';
            console.log(
              `${errorType} hit. Retry attempt ${retries + 1} of ${maxRetries} (backoff: ${backoffMs}ms)...`
            );
            if (retries >= maxRetries) {
              console.error(`Max retries exceeded for ${errorType.toLowerCase()}.`);
              throw geminiError;
            }
            retries++;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }

          console.error('❌ [Gemini] PDF extraction failed:', error);
          throw geminiError;
        }
      }
    } finally {
      // Always cleanup uploaded file
      if (uploadedFile?.name) {
        await geminiService.deleteFile(uploadedFile.name);
      }
    }
  },

  /**
   * Perform OCR on an image buffer using Gemini 2.5 Flash
   */
  performOcrOnImage: async (imageBuffer: Buffer, mimeType = 'image/png'): Promise<string> => {
    try {
      const ai = getGenAI();
      const extractionModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const result = await ai.models.generateContent({
        model: extractionModel,
        contents: [
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType,
            },
          },
          {
            text: 'Transcribe el texto completo de esta página de un documento de seguros. Mantén el formato, saltos de línea y estructura de las tablas lo mejor posible. No agregues comentarios, interpretaciones ni introducciones. Devuelve únicamente el texto transcrito.',
          },
        ],
        config: {
          temperature: 0.1,
        },
      });

      return result.text || '';
    } catch (error: unknown) {
      console.error('❌ [Gemini OCR] Failed to transcribe image:', error);
      throw error;
    }
  },

  /**
   * Extrae la estructura de un deducible utilizando Structured Outputs
   */
  extractDeductible: async (
    deductibleText: string,
    options?: { skipValidation?: boolean }
  ): Promise<DeductibleStructure> => {
    try {
      const ai = getGenAI();
      const extractionModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const prompt = `Analiza este deducible de seguro de una póliza en Colombia y extrae su estructura detallada:
            
Texto del deducible: "${deductibleText}"

Instrucciones para el análisis:
- En Colombia, los deducibles frecuentemente constan de un porcentaje (ej. 10% del siniestro) combinado con un mínimo expresado en SMMLV (Salarios Mínimos Mensuales Legales Vigentes), COP (pesos colombianos) o UVT.
- Ej: "10% con mínimo de 5 SMMLV" tiene dos componentes:
  1. type = "percentage", value = 10
  2. type = "minimum", value = 5, currency = "SMMLV"
- Ej: "Sin deducible", "No aplica", "0%" o "Incluido" tiene isZero = true, y componentes de tipo "na".
- Ej: "10% de la pérdida, mínimo $1.000.000 COP" tiene components: [{type: "percentage", value: 10}, {type: "minimum", value: 1000000, currency: "COP"}].
- Si encuentras expresiones como "de la pérdida", "del siniestro", "del valor asegurado", extrae únicamente la estructura numérica y el tipo de componente.`;

      const result = await ai.models.generateContent({
        model: extractionModel,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: DeductibleSchema as unknown,
        },
      });

      const responseText = result.text;
      if (!responseText) {
        throw new Error('Empty response from Gemini');
      }

      const parseResult = parseJsonWithRepair(responseText);
      if (parseResult.success) {
        if (options?.skipValidation) {
          return parseResult.data as DeductibleStructure;
        }
        return validateGeminiOutput<DeductibleStructure>(
          parseResult.data,
          validateDeductibleStructure,
          'Deductible'
        );
      } else {
        throw new Error(`JSON parsing failed: ${parseResult.error}`);
      }
    } catch (error: unknown) {
      console.error('❌ [Gemini Deductible] Extraction failed:', error);
      throw error;
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
      shouldRetry?: (error: unknown) => boolean;
    } = {}
  ): Promise<T> => {
    const {
      maxRetries = 3,
      baseDelay = 2000,
      maxDelay = 120000,
      shouldRetry = isRetryableError,
    } = options;

    let retries = 0;
    while (true) {
      try {
        return await fn();
      } catch (error: unknown) {
        if (!shouldRetry(error) || retries >= maxRetries) {
          throw error;
        }

        const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
        console.log(`🔄 [Retry] Attempt ${retries + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
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
        const ai = getGenAI();
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        const result = await ai.models.generateContent({
          model: modelName,
          contents: [{ text: prompt }, { text: `\n\n--- DOCUMENTO ---\n\n${text}` }],
          config: {
            temperature: 0.1,
            maxOutputTokens: 32768,
          },
        });

        const responseText = result.text;
        if (!responseText) {
          throw new Error('Empty text response from Gemini');
        }

        console.log(`📄 [Gemini] Response received: ${responseText.length} chars`);

        return responseText;
      } catch (error: unknown) {
        const geminiError = categorizeGeminiError(error);

        const isRateLimit = geminiError instanceof GeminiRateLimitError;

        if (isRateLimit) {
          console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries}...`);
          if (retries >= maxRetries) {
            console.error('Max retries exceeded for rate limit.');
            throw geminiError;
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 20000));
          continue;
        }

        console.error('Error generating content:', error);
        throw geminiError;
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
  extractStructured: async (
    text: string,
    prompt: string,
    pageCount: number = 1
  ): Promise<QuoteExtraction> => {
    let retries = 0;
    const maxRetries = 3;

    // Pre-process text before extraction
    const preprocessed = preprocessText(text, pageCount);
    if (preprocessed.metadata.changes.length > 0) {
      console.log(`🧹 [PreProcessor] Changes: ${preprocessed.metadata.changes.join(', ')}`);
    }

    while (true) {
      try {
        const ai = getGenAI();
        const extractionModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        console.log(`🤖 [Gemini] Using model: ${extractionModel} for extraction`);
        const result = await ai.models.generateContent({
          model: extractionModel,
          contents: [{ text: prompt }, { text: `\n\n--- DOCUMENTO ---\n\n${preprocessed.text}` }],
          config: {
            temperature: 0.1,
            maxOutputTokens: 32768,
            responseMimeType: 'application/json',
            responseSchema: QuoteExtractionSchema as unknown,
          },
        });

        const responseText = result.text;
        if (!responseText) {
          throw new Error('Empty response from Gemini');
        }

        // Try to parse with automatic repair
        const parseResult = parseJsonWithRepair(responseText);

        if (parseResult.success) {
          if (parseResult.wasRepaired) {
            console.log(`🔧 [JSON Repair] Fixed using ${parseResult.repairType}`);
          }

          type MutableExtractionData = QuoteExtraction & {
            premiumSource?: string;
            premiumConfidence?: number;
          };
          const data = parseResult.data as MutableExtractionData;

          // Try premium extraction fallback if priceAnnual is 0 or missing
          if (!data.priceAnnual || data.priceAnnual === 0) {
            console.log(`💰 [Premium] Structured extraction returned 0, trying regex fallback...`);
            const premiumResult = extractAndValidatePremium(0, preprocessed.text);

            if (premiumResult.priceAnnual > 0) {
              data.priceAnnual = premiumResult.priceAnnual;
              data.currency = premiumResult.currency as 'COP' | 'USD';
              data.premiumSource = premiumResult.source;
              data.premiumConfidence = premiumResult.confidence;
              console.log(
                `💰 [Premium] Found via ${premiumResult.source}: ${premiumResult.priceAnnual} ${premiumResult.currency}`
              );
            } else {
              data.premiumSource = 'unknown';
              data.premiumConfidence = 0;
            }
          } else {
            data.premiumSource = 'structured';
            data.premiumConfidence = 95;
          }

          const validated = validateGeminiOutput<QuoteExtraction>(
            data,
            validateQuoteExtraction,
            'Structured'
          );
          console.log(
            `📄 [Gemini] Structured extraction: ${validated.insurerName}, ${validated.coverages?.length || 0} coverages, premium: ${validated.priceAnnual || 0}`
          );
          return validated;
        } else {
          throw new Error(`JSON parsing failed: ${parseResult.error}`);
        }
      } catch (error: unknown) {
        const geminiError = categorizeGeminiError(error);
        const errorMessage = error instanceof Error ? error.message : String(error);

        const isRateLimit = geminiError instanceof GeminiRateLimitError;

        if (isRateLimit) {
          console.log(`Rate limit hit. Retry attempt ${retries + 1} of ${maxRetries}...`);
          if (retries >= maxRetries) {
            console.error('Max retries exceeded for rate limit.');
            throw geminiError;
          }
          retries++;
          await new Promise((resolve) => setTimeout(resolve, 20000));
          continue;
        }

        // If JSON parsing fails or schema validation fails, throw
        if (errorMessage.includes('JSON') || errorMessage.includes('schema')) {
          console.error('❌ [Gemini] Structured extraction failed:', errorMessage);
          throw new GeminiInvalidResponseError(`Structured extraction failed: ${errorMessage}`);
        }

        console.error('Error generating structured content:', error);
        throw geminiError;
      }
    }
  },

  /**
   * Generate narrative text (recommendation, analysis) using Gemini
   * This is the only place where we use Gemini for text generation
   */
  generateNarrative: async (
    analysisData: Record<string, unknown>
  ): Promise<{ recommendation: string; marketAnalysis: string }> => {
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
      recommendation: recMatch
        ? recMatch[1].trim().substring(0, 1500)
        : 'No se pudo generar recomendación',
      marketAnalysis: marketMatch
        ? marketMatch[1].trim().substring(0, 1500)
        : 'No se pudo generar análisis',
    };
  },
};
