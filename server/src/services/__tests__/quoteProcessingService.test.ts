import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectExtractionPrompt,
  enrichRawCoveragesWithGraph,
  createDefaultScoringResult,
} from '../quoteProcessingService';
import { FormatDetectionResult } from '../formatDetector';
import { LayoutParserResult } from '../layoutParser';
import { TemplateRegistryEntry } from '../../schemas/templateRegistrySchema';
import { ParsedQuote } from '../quoteParser';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBuildTemplatePrompt = vi.fn();
const mockBuildPromptForFamily = vi.fn();
const mockCoverageGraphQuery = vi.fn();
const mockFeatureFlags = { isEnabled: vi.fn() };

vi.mock('../promptBuilder', () => ({
  buildTemplatePrompt: (...args: unknown[]) => mockBuildTemplatePrompt(...args),
  buildPromptForFamily: (...args: unknown[]) => mockBuildPromptForFamily(...args),
}));

vi.mock('../coverageGraphService', () => ({
  coverageGraphService: {
    query: (...args: unknown[]) => mockCoverageGraphQuery(...args),
  },
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: (key: string) => mockFeatureFlags.isEnabled(key),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(async () => Array(3072).fill(0)),
    cosineSimilarity: vi.fn(() => 1.0),
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    GEMINI_API_KEY: 'dummy',
    GEMINI_MODEL: 'gemini-3.5-flash',
    GEMINI_CHAT_MODEL: 'gemini-2.5-flash-lite',
    GEMINI_CLAUSE_MODEL: 'gemini-3.5-flash',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-2',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'dummy',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy',
    SUPABASE_JWT_SECRET: 'dummy',
    PORT: 8080,
    NODE_ENV: 'test',
    REGION: 'CO',
    SMMLV_VALUE: 1423500,
    UVT_VALUE: 42412,
    CURRENCY: 'COP',
    CLAUSE_PAGES_BUCKET: 'clause-pages',
    MAX_FILE_SIZE: 52428800,
    MAX_PAGES_LIMIT: 100,
    UPLOAD_TIMEOUT: 300000,
    LOG_LEVEL: 'info',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDetectionResult(overrides: Partial<FormatDetectionResult> = {}): FormatDetectionResult {
  return {
    family: 'TABLE-INTEGRATED',
    confidence: 85,
    detectedPatterns: [],
    templateId: null,
    templateConfidence: null,
    pageCount: 1,
    hasTables: true,
    hasSections: false,
    ...overrides,
  };
}

function makeTemplate(): TemplateRegistryEntry {
  return {
    templateId: 'bbva-pyme-v1',
    insurer: 'BBVA',
    displayName: 'BBVA PYME',
    version: 1,
    fingerprints: {
      textMarkers: ['BBVA SEGUROS'],
      layoutMarkers: [],
      minConfidence: 90,
    },
    schema: {
      type: 'object',
      required: ['coverages'],
      properties: {
        coverages: { type: 'array', items: { type: 'object' } },
      },
    },
    extractionHints: { coverageTablePage: 1, deductibleColumnIndex: 2 },
    promptAddon: 'Extraer deducible de columna 3.',
  };
}

function makeLayoutResult(overrides: Partial<LayoutParserResult> = {}): LayoutParserResult {
  return {
    tables: [],
    regions: [],
    rotatedPages: [],
    failed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectExtractionPrompt', () => {
  beforeEach(() => {
    mockBuildTemplatePrompt.mockReset();
    mockBuildPromptForFamily.mockReset();
    mockBuildTemplatePrompt.mockReturnValue('TEMPLATE_PROMPT');
    mockBuildPromptForFamily.mockReturnValue('GENERIC_PROMPT');
    mockFeatureFlags.isEnabled.mockImplementation((key: string) => {
      if (key === 'useTemplateGraphPipeline') return true;
      return false;
    });
  });

  it('uses template prompt when template matches and layout succeeds', () => {
    const detection = makeDetectionResult({
      templateId: 'bbva-pyme-v1',
      templateConfidence: 95,
    });
    const template = makeTemplate();
    const layout = makeLayoutResult({ failed: false, tables: [{ page: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, headers: [], rows: [] }] });

    const { prompt, usedTemplate } = selectExtractionPrompt(detection, template, layout, { pageCount: 1 });

    expect(usedTemplate).toBe(true);
    expect(prompt).toBe('TEMPLATE_PROMPT');
    expect(mockBuildTemplatePrompt).toHaveBeenCalledWith('bbva-pyme-v1', template, layout.tables);
    expect(mockBuildPromptForFamily).not.toHaveBeenCalled();
  });

  it('falls back to generic prompt when template matches but layout parsing fails', () => {
    const detection = makeDetectionResult({
      templateId: 'bbva-pyme-v1',
      templateConfidence: 95,
    });
    const template = makeTemplate();
    const layout = makeLayoutResult({ failed: true, failureReason: 'rotated pages detected: 1' });

    const { prompt, usedTemplate } = selectExtractionPrompt(detection, template, layout, { pageCount: 1 });

    expect(usedTemplate).toBe(false);
    expect(prompt).toBe('GENERIC_PROMPT');
    expect(mockBuildPromptForFamily).toHaveBeenCalledWith('TABLE-INTEGRATED', expect.any(Object));
  });

  it('falls back to generic prompt when no template matches', () => {
    const detection = makeDetectionResult({ templateId: null, templateConfidence: null });
    const layout = makeLayoutResult();

    const { prompt, usedTemplate } = selectExtractionPrompt(detection, undefined, layout, { pageCount: 1 });

    expect(usedTemplate).toBe(false);
    expect(prompt).toBe('GENERIC_PROMPT');
    expect(mockBuildTemplatePrompt).not.toHaveBeenCalled();
  });

  it('passes page count and table flags to generic prompt', () => {
    const detection = makeDetectionResult({ family: 'TABLE-DOUBLE', hasTables: true });
    const layout = makeLayoutResult();

    selectExtractionPrompt(detection, undefined, layout, { pageCount: 3 });

    expect(mockBuildPromptForFamily).toHaveBeenCalledWith('TABLE-DOUBLE', {
      pageCount: 3,
      hasTables: true,
      formatFamily: 'TABLE-DOUBLE',
    });
  });
});

describe('enrichRawCoveragesWithGraph', () => {
  beforeEach(() => {
    mockCoverageGraphQuery.mockReset();
    mockFeatureFlags.isEnabled.mockImplementation((key: string) => {
      if (key === 'useTemplateGraphPipeline') return true;
      return false;
    });
  });

  it('attaches graph confidence and composite flags when graph returns mappings', async () => {
    mockCoverageGraphQuery.mockResolvedValue({
      mappings: [{ canonicalId: 'incendio-edificio-contenidos', confidence: 0.92, provenance: 'learned' }],
      composite: false,
    });

    const rawCoverages = [{ rawName: 'Daño Material Todo Riesgo', insuredAmount: 500000000 }];
    const result = await enrichRawCoveragesWithGraph(rawCoverages, 'BBVA', 'pyme');

    expect(result[0].graphConfidence).toBe(92);
    expect(result[0].graphProvenance).toBe('learned');
    expect(result[0].isComposite).toBe(false);
  });

  it('marks composite coverages with component list from graph', async () => {
    mockCoverageGraphQuery.mockResolvedValue({
      mappings: [
        { canonicalId: 'incendio-edificio-contenidos', confidence: 0.85, provenance: 'decomposes_to' },
        { canonicalId: 'terremoto-catastrofico', confidence: 0.80, provenance: 'decomposes_to' },
      ],
      composite: true,
      components: ['incendio-edificio-contenidos', 'terremoto-catastrofico'],
    });

    const rawCoverages = [{ rawName: 'Amparo Básico Todo Riesgo' }];
    const result = await enrichRawCoveragesWithGraph(rawCoverages, 'BBVA', 'pyme');

    expect(result[0].isComposite).toBe(true);
    expect(result[0].graphComponents).toEqual(['incendio-edificio-contenidos', 'terremoto-catastrofico']);
  });

  it('returns coverages unchanged when graph query fails', async () => {
    mockCoverageGraphQuery.mockRejectedValue(new Error('graph unavailable'));

    const rawCoverages = [{ rawName: 'Robo' }];
    const result = await enrichRawCoveragesWithGraph(rawCoverages, 'BBVA', 'pyme');

    expect(result).toEqual(rawCoverages);
  });

  it('returns coverages unchanged when graph returns no mappings', async () => {
    mockCoverageGraphQuery.mockResolvedValue({ mappings: [], composite: false });

    const rawCoverages = [{ rawName: 'Cobertura Desconocida' }];
    const result = await enrichRawCoveragesWithGraph(rawCoverages, 'BBVA', 'pyme');

    expect(result[0].graphConfidence).toBeUndefined();
  });
});

describe('createDefaultScoringResult', () => {
  function makeParsedQuote(coverageCount = 2): ParsedQuote {
    return {
      insurerName: 'BBVA',
      policyName: 'PYME',
      priceAnnual: 0,
      currency: 'COP',
      coverages: Array.from({ length: coverageCount }, (_, i) => ({
        name: `Coverage ${i}`,
        canonicalName: `Coverage ${i}`,
        value: '0',
        deductible: 'No aplica',
        confidence: 0,
      })),
      specialConditions: [],
      rawText: '',
      parseConfidence: 0,
    };
  }

  it('returns a zeroed scoring result that reflects the quote coverage count', () => {
    const quote = makeParsedQuote(3);
    const result = createDefaultScoringResult(quote);

    expect(result.totalScore).toBe(0);
    expect(result.dataQualityScore).toBe(0);
    expect(result.verificationConfidence).toBe(0);
    expect(result.breakdown.coverage).toBe(0);
    expect(result.coverageCount).toBe(3);
    expect(result.expectedCoverageCount).toBe(0);
    expect(result.criticalAlerts).toBe(0);
  });
});
