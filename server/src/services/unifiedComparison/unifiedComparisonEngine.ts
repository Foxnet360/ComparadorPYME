/**
 * Unified Comparison Engine
 * Main service for comparing multiple insurance quotes in a single LLM call
 */

import { GoogleGenAI } from "@google/genai";
import { UnifiedComparisonResult, ValidationResult, ComparisonEngineConfig } from "../../types/unifiedComparison";
import { comparisonPromptBuilder } from "./comparisonPromptBuilder";
import { comparisonResultValidator } from "./comparisonResultValidator";
import { UnifiedComparisonSchema } from "./comparisonSchema";
import { parseJsonWithRepair } from "../jsonRepair";

// Initialize Gemini client
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment");
  }
  return new GoogleGenAI({ apiKey });
};

// Default configuration following Gemini 3.5 best practices
const DEFAULT_CONFIG: ComparisonEngineConfig = {
  model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  thinkingLevel: 'MEDIUM',
  responseMimeType: 'application/json',
  responseSchema: UnifiedComparisonSchema,
  maxRetries: 2,
  retryDelayMs: 5000
};

export class UnifiedComparisonEngine {
  private config: ComparisonEngineConfig;

  constructor(config: Partial<ComparisonEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compare multiple insurance quotes in a single LLM call
   */
  async compare(pdfPaths: string[]): Promise<UnifiedComparisonResult> {
    const startTime = Date.now();
    const correlationId = `compare-${Date.now()}`;
    
    console.log(`🔍 [UnifiedComparison] Starting comparison for ${pdfPaths.length} quotes [${correlationId}]`);

    try {
      // 1. Upload PDFs to Gemini
      const uploadedFiles = await this.uploadFiles(pdfPaths);
      console.log(`📤 [UnifiedComparison] Uploaded ${uploadedFiles.length} files [${correlationId}]`);

      // 2. Build prompt
      const prompt = comparisonPromptBuilder.buildComparisonPrompt({
        insurerCount: pdfPaths.length,
        hasClauses: false
      });

      // 3. Call Gemini with structured output
      const result = await this.callGemini(uploadedFiles, prompt, correlationId);

      // 4. Parse and validate response
      const parsedResult = await this.parseAndValidateResult(result, pdfPaths.length);

      // 5. Add metadata
      parsedResult.metadata.processingTimeMs = Date.now() - startTime;
      parsedResult.metadata.pdfCount = pdfPaths.length;

      console.log(`✅ [UnifiedComparison] Completed in ${parsedResult.metadata.processingTimeMs}ms [${correlationId}]`);
      console.log(`📊 [UnifiedComparison] Confidence: ${parsedResult.metadata.confidence}, Needs review: ${parsedResult.metadata.needsHumanReview} [${correlationId}]`);

      return parsedResult;

    } catch (error: any) {
      console.error(`❌ [UnifiedComparison] Failed [${correlationId}]:`, error.message);
      throw new Error(`Comparison failed: ${error.message}`);
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
    
    console.log(`🔍 [DeepMode] Starting clause validation for ${clausePaths.length} clauses [${correlationId}]`);

    try {
      // Upload clause PDFs
      const uploadedClauses = await this.uploadFiles(clausePaths);
      
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

    } catch (error: any) {
      console.error(`❌ [DeepMode] Failed [${correlationId}]:`, error.message);
      throw new Error(`Deep mode validation failed: ${error.message}`);
    }
  }

  /**
   * Upload PDF files to Gemini File API
   */
  private async uploadFiles(filePaths: string[]): Promise<any[]> {
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
      } catch (error: any) {
        console.error(`❌ [UnifiedComparison] Failed to upload ${filePath}:`, error.message);
        throw error;
      }
    }

    return uploadedFiles;
  }

  /**
   * Call Gemini API with structured output
   */
  private async callGemini(
    files: any[],
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
      const result = await ai.models.generateContent({
        model: this.config.model,
        contents,
        config: {
          thinkingConfig: {
            thinkingLevel: this.config.thinkingLevel as any
          },
          responseMimeType: this.config.responseMimeType,
          responseSchema: this.config.responseSchema
        }
      });

      if (!result.text) {
        throw new Error('Empty response from Gemini');
      }

      console.log(`✅ [UnifiedComparison] Gemini response received [${correlationId}]`);
      return result.text;

    } catch (error: any) {
      console.error(`❌ [UnifiedComparison] Gemini call failed [${correlationId}]:`, error.message);
      throw error;
    }
  }

  /**
   * Parse and validate Gemini response
   */
  private async parseAndValidateResult(
    responseText: string,
    expectedInsurerCount: number
  ): Promise<UnifiedComparisonResult> {
    let retries = 0;
    let lastError: string | null = null;

    while (retries <= this.config.maxRetries) {
      try {
        // Try to parse JSON
        const parseResult = parseJsonWithRepair(responseText);
        
        if (!parseResult.success) {
          throw new Error(`JSON parsing failed: ${parseResult.error}`);
        }

        const result = parseResult.data;

        // Validate against schema and business rules
        const validation = comparisonResultValidator.validate(result, expectedInsurerCount);

        if (!validation.isValid) {
          console.warn(`⚠️ [UnifiedComparison] Validation warnings:`, validation.businessWarnings);
        }

        // Add validation metadata
        result.metadata.confidence = validation.confidence;
        result.metadata.needsHumanReview = validation.needsHumanReview;

        return result as UnifiedComparisonResult;

      } catch (error: any) {
        lastError = error.message;
        console.warn(`⚠️ [UnifiedComparison] Parse/validation failed (attempt ${retries + 1}):`, error.message);

        if (retries < this.config.maxRetries) {
          // Retry with correction prompt
          const correctionPrompt = comparisonPromptBuilder.buildCorrectionPrompt(
            responseText,
            lastError || 'Unknown error'
          );
          
          console.log(`🔄 [UnifiedComparison] Retrying with correction prompt...`);
          
          const ai = getGenAI();
          const retryResult = await ai.models.generateContent({
            model: this.config.model,
            contents: [{ text: correctionPrompt }],
            config: {
              thinkingConfig: { thinkingLevel: this.config.thinkingLevel as any },
              responseMimeType: this.config.responseMimeType,
              responseSchema: this.config.responseSchema
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

    throw new Error(`Failed to parse and validate result after ${this.config.maxRetries + 1} attempts. Last error: ${lastError}`);
  }

  /**
   * Apply clause validations to comparison result
   */
  private applyValidations(
    comparison: UnifiedComparisonResult,
    validationResult: any
  ): UnifiedComparisonResult {
    // TODO: Implement deep mode validation application
    // For now, return original with validation notes
    if (validationResult.warnings) {
      comparison.analysis.warnings.push(...validationResult.warnings);
    }
    
    if (validationResult.discrepancies) {
      comparison.analysis.significantDifferences.push(...validationResult.discrepancies);
    }

    return comparison;
  }
}

export const unifiedComparisonEngine = new UnifiedComparisonEngine();
export default unifiedComparisonEngine;
