/**
 * Unified Comparison Engine
 * Main service for comparing multiple insurance quotes in a single LLM call
 */

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ComparisonEngineConfig, UnifiedComparisonResult } from "../../types/unifiedComparison";
import { comparisonPromptBuilder } from "./comparisonPromptBuilder";
import { FlatComparisonResult } from "./comparisonSchema";
import { flatTableParser } from "./flatTableParser";
import { getCachedUnifiedResult, setCachedUnifiedResult } from "../cache/redisCache";
import crypto from "crypto";
import fs from "fs";

export class UnifiedComparisonError extends Error {
  constructor(
    public readonly reason: string,
    public readonly correlationId: string,
    public readonly attempts: number
  ) {
    super(`Unified comparison failed [${correlationId}] after ${attempts} attempts: ${reason}`);
    this.name = 'UnifiedComparisonError';
  }
}

// Initialize Gemini client
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment");
  }
  return new GoogleGenAI({ apiKey });
};

interface GeminiFile {
  name?: string;
  displayName?: string;
  uri?: string;
  state?: string;
}

// Default configuration following Gemini 3.5 best practices
const DEFAULT_CONFIG: ComparisonEngineConfig = {
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  thinkingLevel: 'MEDIUM',
  responseMimeType: 'application/json',
  responseSchema: {},
  maxRetries: 2,
  retryDelayMs: 5000
};

export class UnifiedComparisonEngine {
  private config: ComparisonEngineConfig;

  constructor(config: Partial<ComparisonEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a hash from file paths and their contents for caching
   */
  private generateFileHash(pdfPaths: string[]): string {
    const hash = crypto.createHash('md5');
    for (const path of pdfPaths.sort()) {
      try {
        const stats = fs.statSync(path);
        hash.update(path);
        hash.update(stats.size.toString());
        hash.update(stats.mtime.toISOString());
      } catch (_error) {
        hash.update(path);
      }
    }
    return hash.digest('hex');
  }

  /**
   * Compare multiple insurance quotes in a single LLM call
   */
  async compare(pdfPaths: string[]): Promise<FlatComparisonResult> {
    const startTime = Date.now();
    const correlationId = `compare-${Date.now()}`;
    let uploadedFiles: GeminiFile[] = [];
    
    console.log(`🔍 [UnifiedComparison] Starting comparison for ${pdfPaths.length} quotes [${correlationId}]`);

    // Check cache first
    const fileHash = this.generateFileHash(pdfPaths);
    try {
      const cached = await getCachedUnifiedResult<FlatComparisonResult>(fileHash);
      if (cached) {
        console.log(`✅ [UnifiedComparison] Cache hit for hash ${fileHash.substring(0, 8)}... [${correlationId}]`);
        cached.metadata.processingTimeMs = Date.now() - startTime;
        cached.metadata.fromCache = true;
        return cached;
      }
    } catch (error) {
      console.warn(`⚠️ [UnifiedComparison] Cache check failed [${correlationId}]:`, error);
    }

    try {
      // 1. Upload PDFs to Gemini
      uploadedFiles = await this.uploadFiles(pdfPaths);
      console.log(`📤 [UnifiedComparison] Uploaded ${uploadedFiles.length} files [${correlationId}]`);

      // 2. Build prompt
      const prompt = comparisonPromptBuilder.buildComparisonPrompt({
        insurerCount: pdfPaths.length,
        hasClauses: false
      });

      // 3. Call Gemini with structured output
      const result = await this.callGemini(uploadedFiles, prompt, correlationId);

      // 4. Parse and validate response using the flat table parser
      const parsedResult = await this.parseAndValidateResult(result, pdfPaths.length, correlationId);

      // 5. Add runtime metadata
      parsedResult.metadata.processingTimeMs = Date.now() - startTime;
      parsedResult.metadata.pdfCount = pdfPaths.length;
      parsedResult.metadata.fromCache = false;

      // 6. Cache the result
      try {
        await setCachedUnifiedResult<FlatComparisonResult>(fileHash, parsedResult);
        console.log(`💾 [UnifiedComparison] Cached result for hash ${fileHash.substring(0, 8)}... [${correlationId}]`);
      } catch (error) {
        console.warn(`⚠️ [UnifiedComparison] Failed to cache result [${correlationId}]:`, error);
      }

      console.log(`✅ [UnifiedComparison] Completed in ${parsedResult.metadata.processingTimeMs}ms [${correlationId}]`);
      console.log(`📊 [UnifiedComparison] Insurers: ${parsedResult.insurers.length}, Rows: ${parsedResult.rows.length}, Warnings: ${parsedResult.warnings.length} [${correlationId}]`);

      return parsedResult;

    } catch (error) {
      console.error(`❌ [UnifiedComparison] Failed [${correlationId}]:`, error instanceof Error ? error.message : String(error));
      if (error instanceof UnifiedComparisonError) {
        throw error;
      }
      throw new UnifiedComparisonError(
        error instanceof Error ? error.message : String(error),
        correlationId,
        1
      );
    } finally {
      // Clean up files in Gemini File API
      if (uploadedFiles.length > 0) {
        console.log(`🗑️ [UnifiedComparison] Cleaning up ${uploadedFiles.length} files from Gemini File API... [${correlationId}]`);
        const ai = getGenAI();
        for (const file of uploadedFiles) {
          try {
            await ai.files.delete({ name: file.name ?? '' });
            console.log(`   Deleted: ${file.name ?? 'unknown'} (${file.displayName ?? 'unnamed'})`);
          } catch (deleteError) {
            console.warn(`   ⚠️ Failed to delete file ${file.name ?? 'unknown'} from Gemini API:`, deleteError instanceof Error ? deleteError.message : String(deleteError));
          }
        }
      }
    }
  }

  /**
   * Validate comparison with clause PDFs (deep mode)
   */
  async validateWithClauses(
    comparison: UnifiedComparisonResult,
    clausePaths: string[]
  ): Promise<UnifiedComparisonResult> {
    const correlationId = `deep-${Date.now()}`;
    let uploadedClauses: GeminiFile[] = [];
    
    console.log(`🔍 [DeepMode] Starting clause validation for ${clausePaths.length} clauses [${correlationId}]`);

    try {
      // Upload clause PDFs
      uploadedClauses = await this.uploadFiles(clausePaths);
      
      // Build deep mode prompt
      const prompt = comparisonPromptBuilder.buildDeepModePrompt(
        JSON.stringify(comparison, null, 2)
      );

      // Call Gemini
      const result = await this.callGemini(uploadedClauses, prompt, correlationId);
      
      // Parse validation results
      const validationResult = JSON.parse(result);
      
      // Apply validations to original comparison
      const enrichedComparison = this.applyValidations(comparison, validationResult);

      console.log(`✅ [DeepMode] Completed [${correlationId}]`);
      return enrichedComparison;

    } catch (error) {
      console.error(`❌ [DeepMode] Failed [${correlationId}]:`, error instanceof Error ? error.message : String(error));
      throw new Error(`Deep mode validation failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Clean up files in Gemini File API
      if (uploadedClauses.length > 0) {
        console.log(`🗑️ [DeepMode] Cleaning up ${uploadedClauses.length} files from Gemini File API... [${correlationId}]`);
        const ai = getGenAI();
        for (const file of uploadedClauses) {
          try {
            await ai.files.delete({ name: file.name ?? '' });
            console.log(`   Deleted: ${file.name ?? 'unknown'} (${file.displayName ?? 'unnamed'})`);
          } catch (deleteError) {
            console.warn(`   ⚠️ Failed to delete file ${file.name ?? 'unknown'} from Gemini API:`, deleteError instanceof Error ? deleteError.message : String(deleteError));
          }
        }
      }
    }
  }

  /**
   * Upload PDF files to Gemini File API
   */
  private async uploadFiles(filePaths: string[]): Promise<GeminiFile[]> {
    const ai = getGenAI();
    const uploadedFiles = [];

    for (const filePath of filePaths) {
      try {
        const uploadedFile = await ai.files.upload({
          file: filePath,
          config: {
            mimeType: 'application/pdf',
            displayName: filePath.split('/').pop() || 'quote.pdf'
          }
        });

        // Wait for processing
        const fileName = uploadedFile.name || '';
        let file = await ai.files.get({ name: fileName });
        while (file.state === 'PROCESSING') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          file = await ai.files.get({ name: fileName });
        }

        if (file.state !== 'ACTIVE') {
          throw new Error(`File ${fileName} failed to process`);
        }

        uploadedFiles.push(file);
      } catch (error) {
        console.error(`❌ [UnifiedComparison] Failed to upload ${filePath}:`, error instanceof Error ? error.message : String(error));
        throw error;
      }
    }

    return uploadedFiles;
  }

  /**
   * Call Gemini API with structured output
   */
  private async callGemini(
    files: GeminiFile[],
    prompt: string,
    correlationId: string
  ): Promise<string> {
    const ai = getGenAI();
    
    // Build contents array with PDFs and prompt
    const contents = [
      ...files.map(file => ({
        fileData: {
          fileUri: file.uri,
          mimeType: 'application/pdf'
        }
      })),
      { text: prompt }
    ];

    console.log(`🤖 [UnifiedComparison] Calling Gemini ${this.config.model} [${correlationId}]`);
    console.log(`🤖 [UnifiedComparison] Thinking level: ${this.config.thinkingLevel} [${correlationId}]`);

    try {
      // Add 45-second timeout to prevent hanging
      const TIMEOUT_MS = 45000;

      const config: Record<string, unknown> = {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel[this.config.thinkingLevel]
        },
        responseMimeType: this.config.responseMimeType
      };

      if (Object.keys(this.config.responseSchema).length > 0) {
        config.responseSchema = this.config.responseSchema;
      }

      const geminiPromise = ai.models.generateContent({
        model: this.config.model,
        contents,
        config
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini call timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      );

      const result = await Promise.race([geminiPromise, timeoutPromise]);

      if (!result.text) {
        throw new Error('Empty response from Gemini');
      }

      console.log(`✅ [UnifiedComparison] Gemini response received [${correlationId}]`);
      return result.text;

    } catch (error) {
      console.error(`❌ [UnifiedComparison] Gemini call failed [${correlationId}]:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Parse and validate Gemini response using the flat table parser
   */
  private async parseAndValidateResult(
    responseText: string,
    pdfCount: number,
    correlationId: string
  ): Promise<FlatComparisonResult> {
    let retries = 0;
    let lastError: string | null = null;

    while (retries <= this.config.maxRetries) {
      try {
        const parsedResult = flatTableParser.parse(responseText, {
          pdfCount,
          model: this.config.model,
          confidence: 0,
          needsHumanReview: true,
        });

        return parsedResult;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️ [UnifiedComparison] Flat parse failed (attempt ${retries + 1}) [${correlationId}]:`,
          lastError
        );

        if (retries < this.config.maxRetries) {
          const correctionPrompt = comparisonPromptBuilder.buildCorrectionPrompt(
            responseText,
            lastError || 'Unknown error'
          );

          console.log(`🔄 [UnifiedComparison] Retrying with correction prompt... [${correlationId}]`);

          const ai = getGenAI();
          const retryResult = await ai.models.generateContent({
            model: this.config.model,
            contents: [{ text: correctionPrompt }],
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel[this.config.thinkingLevel] },
              responseMimeType: this.config.responseMimeType
            }
          });

          responseText = retryResult.text || '';
          retries++;

          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
        } else {
          break;
        }
      }
    }

    throw new UnifiedComparisonError(
      `parse_failure: ${lastError}`,
      correlationId,
      retries + 1
    );
  }

  /**
   * Apply clause validations to comparison result
   */
  private applyValidations(
    comparison: UnifiedComparisonResult,
    validationResult: Record<string, unknown>
  ): UnifiedComparisonResult {
    // TODO: Implement deep mode validation application
    // For now, return original with validation notes
    const warnings = validationResult.warnings as string[] | undefined;
    if (warnings) {
      comparison.analysis.warnings.push(...warnings);
    }
    
    const discrepancies = validationResult.discrepancies as Array<{ type: string; insurer: string; description: string; severity: 'high' | 'medium' | 'low' }> | undefined;
    if (discrepancies) {
      comparison.analysis.significantDifferences.push(
        ...discrepancies.map(d => ({
          coverage: d.type,
          difference: `${d.insurer}: ${d.description}`,
          severity: d.severity
        }))
      );
    }

    return comparison;
  }
}

export const unifiedComparisonEngine = new UnifiedComparisonEngine();
export default unifiedComparisonEngine;
