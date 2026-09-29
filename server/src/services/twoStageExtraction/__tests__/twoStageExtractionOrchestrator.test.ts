import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TwoStageExtractionOrchestrator } from '../twoStageExtractionOrchestrator';
import { GlobalStructureExtractor } from '../globalStructureExtractor';
import { FocalizedCoverageExtractor } from '../focalizedCoverageExtractor';
import { geminiService, UploadedFile } from '../../gemini';
import { featureFlags } from '../../../config/featureFlags';
import { QuoteExtractionV2 } from '../../../schemas/extractionSchemas';

vi.mock('../../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
  },
}));

vi.mock('../../gemini', () => ({
  geminiService: {
    uploadFile: vi.fn(),
    waitForFilesActive: vi.fn(),
    deleteFile: vi.fn(),
    extractFromPdfWithVision: vi.fn(),
  },
  getGenAI: vi.fn(),
}));

describe('TwoStageExtractionOrchestrator', () => {
  let mockGlobalExtractor: GlobalStructureExtractor;
  let mockCoverageExtractor: FocalizedCoverageExtractor;
  let orchestrator: TwoStageExtractionOrchestrator;

  const sampleUploadedFile: UploadedFile = {
    name: 'files/test-file-123',
    uri: 'https://gemini.googleapis.com/v1/files/test-file-123',
  };

  const sampleStage1Output = {
    insurerName: 'SURA',
    policyName: 'Empresarial Multirriesgo',
    validityPeriod: '2025-01-01 a 2026-01-01',
    formatFamily: 'TABLE-DOUBLE',
    premium: {
      netPremium: 10000000,
      fees: 50000,
      taxes: 1900000,
      otherCharges: 0,
      totalPayable: 11950000,
      currency: 'COP' as const,
      periodicity: 'Anual',
    },
    insuredAssets: [{ assetType: 'EDIFICIO', value: 500000000 }],
    coverageSections: [{ sectionName: 'AMPAROS BÁSICOS', pageNumber: 2 }],
    specialConditions: ['Inspección previa'],
  };

  const sampleStage2Output = {
    rawCoverages: [
      {
        rawName: 'Incendio y/o Rayo',
        section: 'AMPAROS BÁSICOS',
        insuredAmount: 500000000,
        deductible: '10% de la pérdida mínimo 3 SMMLV',
        rawTextSnippet: 'Incendio y/o Rayo: Límite asegurado $500.000.000 COP con deducible del 10% mínimo 3 SMMLV.',
        pageNumber: 2,
      },
    ],
    subLimits: [],
    generalDeductibles: [],
  };

  const fallbackV2Result: QuoteExtractionV2 = {
    insurerName: 'SURA (Fallback)',
    policyName: 'Póliza Fallback',
    validityPeriod: '2025-01-01',
    formatFamily: 'SECTIONS',
    premium: {
      netPremium: 5000000,
      fees: 0,
      taxes: 950000,
      otherCharges: 0,
      totalPayable: 5950000,
      currency: 'COP',
    },
    rawCoverages: [
      {
        rawName: 'Terremoto',
        rawTextSnippet: 'Amparo de terremoto o temblor según condiciones generales adjuntas.',
        pageNumber: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGlobalExtractor = {
      extract: vi.fn(),
    } as unknown as GlobalStructureExtractor;

    mockCoverageExtractor = {
      extract: vi.fn(),
    } as unknown as FocalizedCoverageExtractor;

    orchestrator = new TwoStageExtractionOrchestrator(
      mockGlobalExtractor,
      mockCoverageExtractor
    );

    (geminiService.uploadFile as any).mockResolvedValue(sampleUploadedFile);
    (geminiService.waitForFilesActive as any).mockResolvedValue(undefined);
    (geminiService.deleteFile as any).mockResolvedValue(undefined);
    (geminiService.extractFromPdfWithVision as any).mockResolvedValue(fallbackV2Result);
  });

  it('delegates to single-stage extraction when feature flag is disabled', async () => {
    (featureFlags.isEnabled as any).mockReturnValue(false);

    const result = await orchestrator.extractTwoStage(
      '/tmp/test.pdf',
      'Test prompt',
      'test.pdf',
      'Extracted native text'
    );

    expect(featureFlags.isEnabled).toHaveBeenCalledWith('enableTwoStageExtraction');
    expect(geminiService.extractFromPdfWithVision).toHaveBeenCalledWith(
      '/tmp/test.pdf',
      'Test prompt',
      'test.pdf',
      'Extracted native text',
      undefined
    );
    expect(mockGlobalExtractor.extract).not.toHaveBeenCalled();
    expect(result).toEqual(fallbackV2Result);
  });

  it('successfully executes Stage 1, Stage 2 and merges cleanly when feature flag is enabled', async () => {
    (featureFlags.isEnabled as any).mockReturnValue(true);
    (mockGlobalExtractor.extract as any).mockResolvedValue(sampleStage1Output);
    (mockCoverageExtractor.extract as any).mockResolvedValue(sampleStage2Output);

    const result = await orchestrator.extractTwoStage(
      '/tmp/quote.pdf',
      'Prompt',
      'quote.pdf'
    );

    expect(geminiService.uploadFile).toHaveBeenCalledWith('/tmp/quote.pdf', 'application/pdf', 'quote.pdf');
    expect(mockGlobalExtractor.extract).toHaveBeenCalledWith(sampleUploadedFile, 'quote.pdf', undefined);
    expect(mockCoverageExtractor.extract).toHaveBeenCalledWith(
      sampleUploadedFile,
      'quote.pdf',
      sampleStage1Output.coverageSections,
      undefined
    );

    expect(result.insurerName).toBe('SURA');
    expect(result.policyName).toBe('Empresarial Multirriesgo');
    expect(result.premium.totalPayable).toBe(11950000);
    expect(result.rawCoverages).toHaveLength(1);
    expect(result.rawCoverages[0].rawName).toBe('Incendio y/o Rayo');
    expect(result.rawCoverages[0].rawTextSnippet).toContain('Incendio y/o Rayo');

    expect(geminiService.deleteFile).toHaveBeenCalledWith(sampleUploadedFile.name);
    expect(geminiService.extractFromPdfWithVision).not.toHaveBeenCalled();
  });

  it('triggers transparent fallback to single-stage when Stage 2 returns 0 coverages', async () => {
    (featureFlags.isEnabled as any).mockReturnValue(true);
    (mockGlobalExtractor.extract as any).mockResolvedValue(sampleStage1Output);
    (mockCoverageExtractor.extract as any).mockResolvedValue({ rawCoverages: [] }); // 0 coverages

    const result = await orchestrator.extractTwoStage(
      '/tmp/quote.pdf',
      'Fallback prompt',
      'quote.pdf'
    );

    expect(geminiService.extractFromPdfWithVision).toHaveBeenCalledWith(
      '/tmp/quote.pdf',
      'Fallback prompt',
      'quote.pdf',
      undefined,
      undefined
    );
    expect(geminiService.deleteFile).toHaveBeenCalledWith(sampleUploadedFile.name);
    expect(result).toEqual(fallbackV2Result);
  });

  it('triggers transparent fallback to single-stage when Stage 1 throws an error', async () => {
    (featureFlags.isEnabled as any).mockReturnValue(true);
    (mockGlobalExtractor.extract as any).mockRejectedValue(new Error('Gemini quota exceeded or schema error'));

    const result = await orchestrator.extractTwoStage(
      '/tmp/quote.pdf',
      'Prompt',
      'quote.pdf'
    );

    expect(geminiService.extractFromPdfWithVision).toHaveBeenCalled();
    expect(geminiService.deleteFile).toHaveBeenCalledWith(sampleUploadedFile.name);
    expect(result).toEqual(fallbackV2Result);
  });
});
