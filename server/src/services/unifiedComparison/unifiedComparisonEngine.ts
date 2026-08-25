/**
 * Unified Comparison Engine
 * Main service for comparing multiple insurance quotes in a single LLM call
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { ComparisonEngineConfig, UnifiedComparisonResult } from '../../types/unifiedComparison';
import { InsuranceDomain } from '../../types/domain';
import { comparisonPromptBuilder } from './comparisonPromptBuilder';
import { FlatComparisonResult } from './comparisonSchema';
import { flatTableParser } from './flatTableParser';
import { unifiedComparisonFlag } from './featureFlagService';
import { coverageGraphService } from '../coverageGraphService';
import { getCachedUnifiedResult, setCachedUnifiedResult } from '../cache/redisCache';
import crypto from 'crypto';
import fs from 'fs';
import { pdfExtractor } from '../pdfExtractor';
import {
  type TemplateMatchInput,
  type TemplateMatchResult,
  type PageTextItems,
  templateRegistryService,
} from '../templateRegistryService';
import {
  templateHintMeasurementHarness,
  type TemplateHintMeasurementHarness,
} from './templateHintMeasurement';

import { CACHE_SCHEMA_VERSION } from '../../config/env';

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
    throw new Error('GEMINI_API_KEY is not set in environment');
  }
  return new GoogleGenAI({ apiKey });
};

interface GeminiFile {
  name?: string;
  displayName?: string;
  uri?: string;
  state?: string;
}

// Default configuration following Gemini 3.7 Flash best practices (High reasoning)
const DEFAULT_CONFIG: ComparisonEngineConfig = {
  model: process.env.GEMINI_MODEL || 'gemini-3.7-flash',
  thinkingLevel: (process.env.GEMINI_THINKING_LEVEL?.toUpperCase() as any) || 'HIGH',
  responseMimeType: 'application/json',
  responseSchema: {},
  maxRetries: 2,
  retryDelayMs: 5000,
};

export interface CompareOptions {
  granularComparisonSchema?: boolean;
  /**
   * Slice flags propagated by the comparison engine adapter. The V1 schema
   * guard forces both to false; the engine only honors them on the V2
   * granular path (behavior wired in the graph/template slices).
   */
  graphEnabled?: boolean;
  templateHintsEnabled?: boolean;
  /**
   * Active insurance domain. Defaults to `pyme` for backward compatibility.
   * Included in the cache hash so autos and pyme results never share a cache
   * entry.
   */
  domain?: InsuranceDomain;
}

export interface TextExtractor {
  extractTextFromPdf(filePath: string): Promise<{ text: string; pageTextItems?: PageTextItems[] }>;
}

export interface TemplateMatcher {
  matchTemplate(input: TemplateMatchInput): Promise<TemplateMatchResult>;
}

export interface UnifiedComparisonEngineDependencies {
  textExtractor: TextExtractor;
  templateMatcher: TemplateMatcher;
  measurementHarness: TemplateHintMeasurementHarness;
}

export class UnifiedComparisonEngine {
  private config: ComparisonEngineConfig;
  private deps: UnifiedComparisonEngineDependencies;

  constructor(
    config: Partial<ComparisonEngineConfig> = {},
    dependencies: Partial<UnifiedComparisonEngineDependencies> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.deps = {
      textExtractor: dependencies.textExtractor ?? pdfExtractor,
      templateMatcher: dependencies.templateMatcher ?? templateRegistryService,
      measurementHarness: dependencies.measurementHarness ?? templateHintMeasurementHarness,
    };
  }

  /**
   * Generate a hash from file paths and their contents for caching.
   * The schema namespace is included so that v1 and v2 results do not share
   * the same cache entry when the granular schema flag is toggled. Slice flags
   * (graph/template hints) are also mixed in so flag-blind cache entries cannot
   * leak graph-enriched payloads to out-of-rollout users.
   */
  private generateFileHash(
    pdfPaths: string[],
    schemaNamespace: string,
    graphEnabled: boolean,
    templateHintsEnabled: boolean,
    domain: InsuranceDomain
  ): string {
    const hash = crypto.createHash('md5');
    hash.update(CACHE_SCHEMA_VERSION); // Invalidate stale Redis cache entries
    hash.update(schemaNamespace);
    hash.update(domain);
    hash.update(graphEnabled ? 'g1' : 'g0');
    hash.update(templateHintsEnabled ? 't1' : 't0');
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
  async compare(pdfPaths: string[], options?: CompareOptions): Promise<FlatComparisonResult> {
    const startTime = Date.now();
    const correlationId = `compare-${Date.now()}`;
    let uploadedFiles: GeminiFile[] = [];
    const granularEnabled =
      options?.granularComparisonSchema ??
      unifiedComparisonFlag.isGranularComparisonSchemaEnabled();
    const graphEnabled = granularEnabled && (options?.graphEnabled ?? false);
    const templateHintsEnabled = granularEnabled && (options?.templateHintsEnabled ?? false);
    const domain: InsuranceDomain = options?.domain ?? 'pyme';

    console.log(
      `🔍 [UnifiedComparison] Starting comparison for ${pdfPaths.length} quotes [${correlationId}] domain=${domain}`
    );
    console.log(
      `🚩 [UnifiedComparison] granularComparisonSchema=${granularEnabled} graphEnabled=${graphEnabled} templateHintsEnabled=${templateHintsEnabled} [${correlationId}]`
    );

    // Check cache first
    const fileHash = this.generateFileHash(
      pdfPaths,
      granularEnabled ? 'v2' : 'v1',
      graphEnabled,
      templateHintsEnabled,
      domain
    );
    try {
      const cached = await getCachedUnifiedResult<FlatComparisonResult>(fileHash);
      if (cached) {
        console.log(
          `✅ [UnifiedComparison] Cache hit for hash ${fileHash.substring(0, 8)}... [${correlationId}]`
        );
        cached.metadata.processingTimeMs = Date.now() - startTime;
        cached.metadata.fromCache = true;
        return cached;
      }
    } catch (error) {
      console.warn(`⚠️ [UnifiedComparison] Cache check failed [${correlationId}]:`, error);
    }

    try {
      // 1. Match templates and collect insurer addons before the LLM call.
      let templateAddons: string[] = [];
      let matchedInsurers: string[] = [];
      if (templateHintsEnabled) {
        const matchResult = await this.matchTemplates(pdfPaths, correlationId, domain);
        templateAddons = matchResult.addons;
        matchedInsurers = matchResult.insurers;
        console.log(
          `🧩 [UnifiedComparison] Template hints active: ${matchedInsurers.length} insurer(s) matched [${correlationId}]`
        );
      }

      // 2. Upload PDFs to Gemini
      uploadedFiles = await this.uploadFiles(pdfPaths);
      console.log(
        `📤 [UnifiedComparison] Uploaded ${uploadedFiles.length} files [${correlationId}]`
      );

      // 3. Build prompt
      const promptContext = {
        insurerCount: pdfPaths.length,
        hasClauses: false,
      };
      const prompt = granularEnabled
        ? comparisonPromptBuilder.buildV2ComparisonPrompt(promptContext, templateAddons)
        : comparisonPromptBuilder.buildComparisonPrompt(promptContext);

      // 4. Call Gemini with structured output
      const geminiStartTime = Date.now();
      const result = await this.callGemini(uploadedFiles, prompt, correlationId);
      const geminiLatencyMs = Date.now() - geminiStartTime;

      // 5. Parse and validate response using the appropriate parser
      const parsedResult = await this.parseAndValidateResult(
        result,
        pdfPaths.length,
        correlationId,
        granularEnabled,
        graphEnabled,
        domain
      );

      // 6. Add runtime metadata
      parsedResult.metadata.processingTimeMs = Date.now() - startTime;
      parsedResult.metadata.pdfCount = pdfPaths.length;
      parsedResult.metadata.fromCache = false;

      // 7. Record per-insurer cost/latency observations for hints that were used.
      // Fire-and-forget: the measurement harness is fail-open and must never
      // block the response, even if Redis is slow or unavailable.
      if (templateHintsEnabled && matchedInsurers.length > 0) {
        const tokenCount = this.estimatePromptTokens(prompt);
        for (const insurer of matchedInsurers) {
          this.deps.measurementHarness
            .recordObservation(insurer, tokenCount, geminiLatencyMs)
            .catch((error) => {
              console.warn(
                `⚠️ [UnifiedComparison] Failed to record template hint observation for ${insurer} [${correlationId}]:`,
                error
              );
            });
        }
      }

      // 8. Cache the result
      try {
        await setCachedUnifiedResult<FlatComparisonResult>(fileHash, parsedResult);
        console.log(
          `💾 [UnifiedComparison] Cached result for hash ${fileHash.substring(0, 8)}... [${correlationId}]`
        );
      } catch (error) {
        console.warn(`⚠️ [UnifiedComparison] Failed to cache result [${correlationId}]:`, error);
      }

      console.log(
        `✅ [UnifiedComparison] Completed in ${parsedResult.metadata.processingTimeMs}ms [${correlationId}]`
      );
      console.log(
        `📊 [UnifiedComparison] Insurers: ${parsedResult.insurers.length}, Rows: ${parsedResult.rows.length}, Warnings: ${parsedResult.warnings.length} [${correlationId}]`
      );

      return parsedResult;
    } catch (error) {
      console.error(
        `❌ [UnifiedComparison] Failed [${correlationId}]:`,
        error instanceof Error ? error.message : String(error)
      );
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
        console.log(
          `🗑️ [UnifiedComparison] Cleaning up ${uploadedFiles.length} files from Gemini File API... [${correlationId}]`
        );
        const ai = getGenAI();
        for (const file of uploadedFiles) {
          try {
            await ai.files.delete({ name: file.name ?? '' });
            console.log(`   Deleted: ${file.name ?? 'unknown'} (${file.displayName ?? 'unnamed'})`);
          } catch (deleteError) {
            console.warn(
              `   ⚠️ Failed to delete file ${file.name ?? 'unknown'} from Gemini API:`,
              deleteError instanceof Error ? deleteError.message : String(deleteError)
            );
          }
        }
      }
    }
  }

  /**
   * Extract text from each PDF and match against the template registry.
   * Returns a list of labeled insurer addons to append to the v2 prompt and
   * the list of insurers whose hints were actually used (for measurement).
   * Fail-open: extraction or matching errors are logged and do not block the
   * request; the caller falls back to the generic prompt.
   */
  private async matchTemplates(
    pdfPaths: string[],
    correlationId: string,
    domain: InsuranceDomain
  ): Promise<{ addons: string[]; insurers: string[] }> {
    const addons: string[] = [];
    const insurers: string[] = [];
    const seenInsurers = new Set<string>();

    for (const path of pdfPaths) {
      let text: string;
      let pages: PageTextItems[] | undefined;
      try {
        const extraction = await this.deps.textExtractor.extractTextFromPdf(path);
        text = extraction.text;
        pages = extraction.pageTextItems;
      } catch (error) {
        console.warn(
          `⚠️ [UnifiedComparison] Failed to extract PDF text for template matching ${path} [${correlationId}]:`,
          error instanceof Error ? error.message : String(error)
        );
        continue;
      }

      try {
        const match = await this.deps.templateMatcher.matchTemplate({
          text,
          pages,
          domain,
        });
        if (!match.insurer || !match.promptAddon) {
          continue;
        }

        const normalizedInsurer = match.insurer.toUpperCase();
        if (seenInsurers.has(normalizedInsurer)) {
          continue;
        }
        seenInsurers.add(normalizedInsurer);

        const disableCheck = await this.deps.measurementHarness.shouldDisable(normalizedInsurer);
        if (disableCheck.disabled) {
          console.log(
            `🚫 [UnifiedComparison] Template hints disabled for ${normalizedInsurer} (${disableCheck.reason}) [${correlationId}]`
          );
          continue;
        }

        addons.push(`${match.insurer}:\n${match.promptAddon}`);
        insurers.push(normalizedInsurer);
      } catch (error) {
        console.warn(
          `⚠️ [UnifiedComparison] Template matching failed for ${path} [${correlationId}]:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    return { addons, insurers };
  }

  /**
   * Rough token estimation for prompt cost guardrails.
   * Uses the same heuristic as chatService (chars / 4) so measurements are
   * consistent with the rest of the codebase.
   */
  private estimatePromptTokens(prompt: string): number {
    return Math.ceil(prompt.length / 4);
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

    console.log(
      `🔍 [DeepMode] Starting clause validation for ${clausePaths.length} clauses [${correlationId}]`
    );

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
      console.error(
        `❌ [DeepMode] Failed [${correlationId}]:`,
        error instanceof Error ? error.message : String(error)
      );
      throw new Error(
        `Deep mode validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      // Clean up files in Gemini File API
      if (uploadedClauses.length > 0) {
        console.log(
          `🗑️ [DeepMode] Cleaning up ${uploadedClauses.length} files from Gemini File API... [${correlationId}]`
        );
        const ai = getGenAI();
        for (const file of uploadedClauses) {
          try {
            await ai.files.delete({ name: file.name ?? '' });
            console.log(`   Deleted: ${file.name ?? 'unknown'} (${file.displayName ?? 'unnamed'})`);
          } catch (deleteError) {
            console.warn(
              `   ⚠️ Failed to delete file ${file.name ?? 'unknown'} from Gemini API:`,
              deleteError instanceof Error ? deleteError.message : String(deleteError)
            );
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
            displayName: filePath.split('/').pop() || 'quote.pdf',
          },
        });

        // Wait for processing
        const fileName = uploadedFile.name || '';
        let file = await ai.files.get({ name: fileName });
        while (file.state === 'PROCESSING') {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          file = await ai.files.get({ name: fileName });
        }

        if (file.state !== 'ACTIVE') {
          throw new Error(`File ${fileName} failed to process`);
        }

        uploadedFiles.push(file);
      } catch (error) {
        console.error(
          `❌ [UnifiedComparison] Failed to upload ${filePath}:`,
          error instanceof Error ? error.message : String(error)
        );
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
      ...files.map((file) => ({
        fileData: {
          fileUri: file.uri,
          mimeType: 'application/pdf',
        },
      })),
      { text: prompt },
    ];

    console.log(`🤖 [UnifiedComparison] Calling Gemini ${this.config.model} [${correlationId}]`);
    console.log(
      `🤖 [UnifiedComparison] Thinking level: ${this.config.thinkingLevel} [${correlationId}]`
    );

    try {
      // Add configurable timeout to prevent hanging; V2 granular schema with multiple
      // PDFs can legitimately take longer than the old 45-second default.
      const TIMEOUT_MS = parseInt(process.env.GEMINI_UNIFIED_TIMEOUT_MS || '120000', 10);

      const config: Record<string, unknown> = {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel[this.config.thinkingLevel],
        },
        responseMimeType: this.config.responseMimeType,
        maxOutputTokens: 16384,
      };

      if (Object.keys(this.config.responseSchema).length > 0) {
        config.responseSchema = this.config.responseSchema;
      }

      const geminiPromise = ai.models.generateContent({
        model: this.config.model,
        contents,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Gemini call timed out after ${TIMEOUT_MS}ms`)),
          TIMEOUT_MS
        )
      );

      const result = await Promise.race([geminiPromise, timeoutPromise]);

      if (!result.text) {
        throw new Error('Empty response from Gemini');
      }

      console.log(`✅ [UnifiedComparison] Gemini response received [${correlationId}]`);
      return result.text;
    } catch (error) {
      console.error(
        `❌ [UnifiedComparison] Gemini call failed [${correlationId}]:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * Parse and validate Gemini response using the flat table parser
   */
  private async parseAndValidateResult(
    responseText: string,
    pdfCount: number,
    correlationId: string,
    granularEnabled: boolean,
    graphEnabled?: boolean,
    domain: InsuranceDomain = 'pyme'
  ): Promise<FlatComparisonResult> {
    let retries = 0;
    let lastError: string | null = null;

    while (retries <= this.config.maxRetries) {
      try {
        const parseOptions = {
          pdfCount,
          model: this.config.model,
          confidence: 0,
          needsHumanReview: true,
          domain,
          ...(granularEnabled
            ? { graphEnabled: graphEnabled ?? false, graphService: coverageGraphService }
            : {}),
        };

        const parsedResult = granularEnabled
          ? await flatTableParser.parseV2(responseText, parseOptions)
          : flatTableParser.parse(responseText, parseOptions);

        return parsedResult;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(
          `⚠️ [UnifiedComparison] ${granularEnabled ? 'Granular' : 'Flat'} parse failed (attempt ${retries + 1}) [${correlationId}]:`,
          lastError
        );

        if (retries < this.config.maxRetries) {
          const correctionPrompt = granularEnabled
            ? comparisonPromptBuilder.buildV2CorrectionPrompt(
                responseText,
                lastError || 'Unknown error'
              )
            : comparisonPromptBuilder.buildCorrectionPrompt(
                responseText,
                lastError || 'Unknown error'
              );

          console.log(
            `🔄 [UnifiedComparison] Retrying with ${granularEnabled ? 'v2' : 'v1'} correction prompt... [${correlationId}]`
          );

          const ai = getGenAI();
          const retryResult = await ai.models.generateContent({
            model: this.config.model,
            contents: [{ text: correctionPrompt }],
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel[this.config.thinkingLevel] },
              responseMimeType: this.config.responseMimeType,
            },
          });

          responseText = retryResult.text || '';
          retries++;

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, this.config.retryDelayMs));
        } else {
          break;
        }
      }
    }

    throw new UnifiedComparisonError(`parse_failure: ${lastError}`, correlationId, retries + 1);
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

    const discrepancies = validationResult.discrepancies as
      | Array<{
          type: string;
          insurer: string;
          description: string;
          severity: 'high' | 'medium' | 'low';
        }>
      | undefined;
    if (discrepancies) {
      comparison.analysis.significantDifferences.push(
        ...discrepancies.map((d) => ({
          coverage: d.type,
          difference: `${d.insurer}: ${d.description}`,
          severity: d.severity,
        }))
      );
    }

    return comparison;
  }
}

export const unifiedComparisonEngine = new UnifiedComparisonEngine();
export default unifiedComparisonEngine;
