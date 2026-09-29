import { featureFlags } from '../../config/featureFlags';
import { geminiService, UploadedFile } from '../gemini';
import { QuoteExtractionV2, validateQuoteExtractionV2 } from '../../schemas/extractionSchemas';
import { globalStructureExtractor, GlobalStructureExtractor } from './globalStructureExtractor';
import { focalizedCoverageExtractor, FocalizedCoverageExtractor } from './focalizedCoverageExtractor';

export interface TwoStageOrchestratorOptions {
  skipValidation?: boolean;
  onRepairUsed?: (category: string) => void;
}

export class TwoStageExtractionOrchestrator {
  constructor(
    private globalExtractor: GlobalStructureExtractor = globalStructureExtractor,
    private coverageExtractor: FocalizedCoverageExtractor = focalizedCoverageExtractor
  ) {}

  public async extractTwoStage(
    pdfPath: string,
    prompt: string,
    filename: string,
    extractedText?: string,
    options?: TwoStageOrchestratorOptions
  ): Promise<QuoteExtractionV2> {
    if (!featureFlags.isEnabled('enableTwoStageExtraction')) {
      console.log('ℹ️ [TwoStageOrchestrator] Two-stage extraction disabled by feature flag. Delegating to single-stage V2.');
      return geminiService.extractFromPdfWithVision(
        pdfPath,
        prompt,
        filename,
        extractedText,
        options
      );
    }

    let uploadedFile: UploadedFile | null = null;

    try {
      console.log(`🚀 [TwoStageOrchestrator] Starting two-stage extraction for: ${filename}`);

      // Step 1: Upload PDF to Gemini
      uploadedFile = await geminiService.uploadFile(pdfPath, 'application/pdf', filename);
      await geminiService.waitForFilesActive([uploadedFile]);

      // Step 2: Stage 1 - Global Structure Extraction
      console.log(`   [1/2] Executing Stage 1: Global structure & financial breakdown...`);
      const stage1 = await this.globalExtractor.extract(uploadedFile, filename, extractedText);

      // Step 3: Stage 2 - Focalized Coverage Extraction
      console.log(`   [2/2] Executing Stage 2: Focalized coverage & deductible mapping...`);
      const stage2 = await this.coverageExtractor.extract(
        uploadedFile,
        filename,
        stage1.coverageSections ?? undefined,
        extractedText
      );

      if (!stage2.rawCoverages || stage2.rawCoverages.length === 0) {
        throw new Error('Stage 2 returned 0 coverages; triggering fallback to standard extraction');
      }

      // Step 4: Merge results into QuoteExtractionV2 contract
      const merged: QuoteExtractionV2 = {
        insurerName: stage1.insurerName,
        policyName: stage1.policyName,
        validityPeriod: stage1.validityPeriod ?? null,
        formatFamily: stage1.formatFamily || 'UNKNOWN',
        premium: stage1.premium,
        insuredAssets: stage1.insuredAssets ?? null,
        rawCoverages: stage2.rawCoverages,
        subLimits: stage2.subLimits ?? null,
        generalDeductibles: stage2.generalDeductibles ?? null,
        specialConditions: stage1.specialConditions ?? null,
        exclusions: stage1.exclusions ?? null,
        warranties: stage1.warranties ?? null,
      };

      if (!options?.skipValidation) {
        const validation = validateQuoteExtractionV2(merged);
        if (!validation.success) {
          throw new Error(`Merged two-stage output failed Zod validation: ${validation.error?.message}`);
        }
      }

      console.log(
        `🎉 [TwoStageOrchestrator] Two-stage extraction successful: Insurer="${merged.insurerName}", Coverages=${merged.rawCoverages.length}, TotalPremium=${merged.premium?.totalPayable}`
      );

      return merged;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `⚠️ [TwoStageOrchestrator] Two-stage pipeline encountered an error: "${errorMsg}". Executing automatic fallback to standard single-stage V2 extraction.`
      );

      return geminiService.extractFromPdfWithVision(
        pdfPath,
        prompt,
        filename,
        extractedText,
        options
      );
    } finally {
      if (uploadedFile?.name) {
        await geminiService.deleteFile(uploadedFile.name);
      }
    }
  }
}

export const twoStageExtractionOrchestrator = new TwoStageExtractionOrchestrator();
