import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  selectExtractionPrompt,
} from '../quoteProcessingService';
import { FormatDetectionResult } from '../formatDetector';
import { LayoutParserResult } from '../layoutParser';
import { TemplateRegistryEntry } from '../../schemas/templateRegistrySchema';
import {
  createStructuredLogger,
  createMetricCollector,
  StructuredLogEntry,
  MetricCollector,
} from '../../utils/structuredLogger';

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

const mockBuildTemplatePrompt = vi.fn();
const mockBuildPromptForFamily = vi.fn();

vi.mock('../promptBuilder', () => ({
  buildTemplatePrompt: (...args: any[]) => mockBuildTemplatePrompt(...args),
  buildPromptForFamily: (...args: any[]) => mockBuildPromptForFamily(...args),
}));

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
    schema: { type: 'object' },
    extractionHints: { coverageTablePage: 1, deductibleColumnIndex: 2 },
    promptAddon: '',
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

describe('quoteProcessingService metrics and logging', () => {
  let entries: StructuredLogEntry[];
  let metrics: MetricCollector;
  let logger: ReturnType<typeof createStructuredLogger>;

  beforeEach(() => {
    entries = [];
    metrics = createMetricCollector();
    logger = createStructuredLogger('quoteProcessingService', {
      sink: (entry) => entries.push(entry),
    });
    mockBuildTemplatePrompt.mockReset();
    mockBuildPromptForFamily.mockReset();
    mockBuildTemplatePrompt.mockReturnValue('TEMPLATE_PROMPT');
    mockBuildPromptForFamily.mockReturnValue('GENERIC_PROMPT');
  });

  it('logs pipeline_path_taken=template when a template prompt is selected', () => {
    const detection = makeDetectionResult({
      templateId: 'bbva-pyme-v1',
      templateConfidence: 95,
    });
    const template = makeTemplate();
    const layout = makeLayoutResult({
      failed: false,
      tables: [{ page: 1, bounds: { x: 0, y: 0, width: 100, height: 100 }, headers: [], rows: [] }],
    });

    selectExtractionPrompt(detection, template, layout, { pageCount: 1, logger, metrics });

    const log = entries.find((e) => e.event === 'pipeline_path_taken');
    expect(log).toBeDefined();
    expect(log?.path).toBe('template');
    expect(log?.templateId).toBe('bbva-pyme-v1');
    expect(metrics.snapshot().counters['quoteProcessing.pipeline_path|path=template']).toBe(1);
  });

  it('logs pipeline_path_taken=generic when layout parsing fails', () => {
    const detection = makeDetectionResult({
      templateId: 'bbva-pyme-v1',
      templateConfidence: 95,
    });
    const template = makeTemplate();
    const layout = makeLayoutResult({ failed: true, failureReason: 'rotated pages detected: 1' });

    selectExtractionPrompt(detection, template, layout, { pageCount: 1, logger, metrics });

    const log = entries.find((e) => e.event === 'pipeline_path_taken');
    expect(log).toBeDefined();
    expect(log?.path).toBe('generic');
    expect(log?.fallbackReason).toContain('layout');
    expect(metrics.snapshot().counters['quoteProcessing.pipeline_path|path=generic']).toBe(1);
  });

  it('logs pipeline_path_taken=generic when no template matches', () => {
    const detection = makeDetectionResult({ templateId: null, templateConfidence: null });
    const layout = makeLayoutResult();

    selectExtractionPrompt(detection, undefined, layout, { pageCount: 1, logger, metrics });

    const log = entries.find((e) => e.event === 'pipeline_path_taken');
    expect(log?.path).toBe('generic');
    expect(log?.fallbackReason).toContain('no template');
    expect(metrics.snapshot().counters['quoteProcessing.pipeline_path|path=generic']).toBe(1);
  });
});
