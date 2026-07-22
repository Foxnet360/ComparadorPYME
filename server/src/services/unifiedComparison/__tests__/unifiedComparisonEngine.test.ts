/**
 * Unified Comparison Engine Tests
 * Tests flat-parser wiring, retry on parse failure, and structured errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedComparisonEngine, UnifiedComparisonError } from '../unifiedComparisonEngine';
import { featureFlags } from '../../../config/featureFlags';
import type { FlatComparisonResult } from '../comparisonSchema';
import type { PageTextItems, TemplateMatchResult } from '../../templateRegistryService';
import type { TemplateHintMeasurementHarness } from '../templateHintMeasurement';

const validFlatJson = JSON.stringify({
  insurers: ['MAPFRE', 'CHUBB'],
  rows: [
    {
      label: 'Bienes Asegurados',
      cells: [
        { insurer: 'MAPFRE', value: 'Edificio + contenidos' },
        { insurer: 'CHUBB', value: 'Edificio' },
      ],
    },
    {
      label: 'Deducibles',
      cells: [
        { insurer: 'MAPFRE', value: '10%' },
        { insurer: 'CHUBB', value: '5%' },
      ],
    },
    {
      label: 'Prima con IVA',
      cells: [
        { insurer: 'MAPFRE', value: '$1.000.000' },
        { insurer: 'CHUBB', value: '$900.000' },
      ],
    },
    {
      label: 'Forma de Pago',
      cells: [
        { insurer: 'MAPFRE', value: 'Anual' },
        { insurer: 'CHUBB', value: 'Mensual' },
      ],
    },
  ],
});

const validGranularJson = JSON.stringify({
  insurers: ['MAPFRE', 'CHUBB'],
  rows: [
    {
      label: 'Edificio',
      section: 'BIENES ASEGURADOS',
      cells: [
        { insurer: 'MAPFRE', value: '$500M', rawText: '$500M' },
        { insurer: 'CHUBB', value: '$600M', rawText: '$600M' },
      ],
    },
    {
      label: 'Prima con IVA',
      section: 'INFORMACIÓN GENERAL',
      cells: [
        { insurer: 'MAPFRE', value: '$1.000.000', rawText: '$1.000.000' },
        { insurer: 'CHUBB', value: '$900.000', rawText: '$900.000' },
      ],
    },
  ],
});

const malformedJson = 'this is not json';

interface MockGeminiInstance {
  files: {
    upload: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  models: {
    generateContent: ReturnType<typeof vi.fn>;
  };
}

let activeMock: MockGeminiInstance | null = null;
let responseQueue: string[] = [];
let generateContentCallCount = 0;

function buildMockGemini(responses: string[]): MockGeminiInstance {
  responseQueue = [...responses];
  generateContentCallCount = 0;

  activeMock = {
    files: {
      upload: vi.fn().mockResolvedValue({ name: 'file-0' }),
      get: vi.fn().mockResolvedValue({ state: 'ACTIVE', name: 'file-0', uri: 'uri://test' }),
      delete: vi.fn().mockResolvedValue({}),
    },
    models: {
      generateContent: vi.fn().mockImplementation(function () {
        const text = responseQueue[generateContentCallCount] ?? malformedJson;
        generateContentCallCount += 1;
        return Promise.resolve({ text });
      }),
    },
  };

  return activeMock;
}

function MockGoogleGenAIConstructor() {
  if (!activeMock) {
    throw new Error('MockGoogleGenAIConstructor called before buildMockGemini');
  }
  return activeMock;
}

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: MockGoogleGenAIConstructor,
    ThinkingLevel: {
      MINIMAL: 'MINIMAL',
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
    },
    Type: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT',
    },
  };
});

let mockGemini: ReturnType<typeof buildMockGemini>;

describe('UnifiedComparisonEngine (flat table)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
    mockGemini = buildMockGemini([]);
    featureFlags.updateFlag('granularComparisonSchema', false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    featureFlags.updateFlag('granularComparisonSchema', true);
  });

  it('should return a FlatComparisonResult on a valid flat JSON response', async () => {
    mockGemini = buildMockGemini([validFlatJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const result = (await engine.compare([
      'valid-fake1.pdf',
      'valid-fake2.pdf',
    ])) as FlatComparisonResult;

    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].label).toBe('Bienes Asegurados');
    expect(result.rows[0].cells[0]).toEqual({
      insurer: 'MAPFRE',
      value: 'Edificio + contenidos',
      rawText: 'Edificio + contenidos',
    });
    expect(result.metadata.pdfCount).toBe(2);
    expect(result.metadata.fromCache).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('should retry up to 2 times on parse failure and then throw a structured UnifiedComparisonError', async () => {
    // Initial call + 2 retries = 3 total generateContent calls, all failing.
    mockGemini = buildMockGemini([malformedJson, malformedJson, malformedJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });

    let thrownError: unknown;
    try {
      await engine.compare(['retry-fake1.pdf']);
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(UnifiedComparisonError);
    expect((thrownError as UnifiedComparisonError).reason).toContain('parse');
    expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(3);
  });

  it('should succeed on the first retry when the correction response is valid', async () => {
    mockGemini = buildMockGemini([malformedJson, validFlatJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const result = (await engine.compare([
      'correction-fake1.pdf',
      'correction-fake2.pdf',
    ])) as FlatComparisonResult;

    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(2);

    const secondCall = mockGemini.models.generateContent.mock.calls[1][0];
    expect(secondCall.contents[0].text).toContain('ERROR:');
    expect(secondCall.contents[0].text).toContain('Bienes Asegurados');
  });

  it('should expose correlationId and reason on UnifiedComparisonError', async () => {
    mockGemini = buildMockGemini([malformedJson, malformedJson, malformedJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });

    try {
      await engine.compare(['structured-fake1.pdf']);
      expect.fail('Expected UnifiedComparisonError to be thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnifiedComparisonError);
      const structured = error as UnifiedComparisonError;
      expect(structured.correlationId).toMatch(/^compare-\d+$/);
      expect(structured.reason).toContain('parse');
      expect(structured.attempts).toBe(3);
    }
  });

  it('should return cached result without calling Gemini when cache hits', async () => {
    mockGemini = buildMockGemini([validFlatJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const first = (await engine.compare([
      'cache-fake1.pdf',
      'cache-fake2.pdf',
    ])) as FlatComparisonResult;

    // Second call with the same paths should hit the cache.
    const second = (await engine.compare([
      'cache-fake1.pdf',
      'cache-fake2.pdf',
    ])) as FlatComparisonResult;

    expect(second.metadata.fromCache).toBe(true);
    expect(second.insurers).toEqual(first.insurers);
    // Gemini should only have been called once.
    expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(1);
  });

  it('should use the v2 parser and prompt when granularComparisonSchema is enabled', async () => {
    mockGemini = buildMockGemini([validGranularJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const result = await engine.compare(['granular-fake1.pdf', 'granular-fake2.pdf'], {
      granularComparisonSchema: true,
    });

    expect(result.schemaVersion).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].label).toBe('Edificio');
    expect(result.rows[0].section).toBe('BIENES ASEGURADOS');
    expect(result.rows[0].cells[0].confidence).toBeGreaterThan(0.7);

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    expect(promptCall.contents[promptCall.contents.length - 1].text).toContain(
      'filas agrupadas por sección'
    );
  });

  it('should keep v1 behavior when granularComparisonSchema is disabled', async () => {
    mockGemini = buildMockGemini([validFlatJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const result = await engine.compare(['v1-fake1.pdf', 'v1-fake2.pdf'], {
      granularComparisonSchema: false,
    });

    expect(result.schemaVersion).toBe(1);
    expect(result.rows).toHaveLength(4);

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    expect(promptCall.contents[promptCall.contents.length - 1].text).toContain(
      'EXACTAMENTE estas filas'
    );
  });

  it('should not share cache between v1 and v2 for the same files', async () => {
    mockGemini = buildMockGemini([validGranularJson, validFlatJson]);

    const engine = new UnifiedComparisonEngine({ retryDelayMs: 0 });
    const v2 = await engine.compare(['cache-v1v2-fake1.pdf', 'cache-v1v2-fake2.pdf'], {
      granularComparisonSchema: true,
    });
    expect(v2.schemaVersion).toBe(2);

    const v1 = await engine.compare(['cache-v1v2-fake1.pdf', 'cache-v1v2-fake2.pdf'], {
      granularComparisonSchema: false,
    });
    expect(v1.schemaVersion).toBe(1);

    // If the cache key did not include the schema version, the second call would
    // hit the v2 cache and skip the Gemini call.
    expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(2);
  });
});

function makeTextExtractor(
  results: Record<string, { text: string; pageTextItems?: PageTextItems[] }>
) {
  return {
    extractTextFromPdf: vi.fn(async (path: string) => {
      const result = results[path];
      if (!result) {
        return { text: '', pageTextItems: [] };
      }
      return result;
    }),
  };
}

function makeTemplateMatcher(matches: Record<string, TemplateMatchResult>) {
  return {
    matchTemplate: vi.fn(
      async (input: { text: string; pages?: PageTextItems[]; domain?: string }) => {
        return (
          matches[input.text] ?? {
            templateId: null,
            templateConfidence: null,
            insurer: null,
            promptAddon: '',
            template: null,
          }
        );
      }
    ),
  };
}

function makeMeasurementHarness(
  disabledInsurers: Set<string> = new Set()
): TemplateHintMeasurementHarness {
  return {
    recordObservation: vi.fn(async () => {}),
    shouldDisable: vi.fn(async (insurer: string) => ({
      disabled: disabledInsurers.has(insurer),
      reason: disabledInsurers.has(insurer) ? ('token_increase' as const) : undefined,
    })),
    setBaseline: vi.fn(async () => {}),
  };
}

describe('UnifiedComparisonEngine (template-aware prompts)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
    mockGemini = buildMockGemini([]);
    featureFlags.updateFlag('granularComparisonSchema', true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('injects a matched insurer addon into the v2 prompt', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-fake.pdf': { text: 'BBVA SEGUROS COBERTURAS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS COBERTURAS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'Extrae deducibles de la columna 3.',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).toContain('BBVA:');
    expect(promptText).toContain('Extrae deducibles de la columna 3.');
  });

  it('keeps the generic v2 prompt when no template matches', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'generic-fake.pdf': { text: 'Cotizacion generica sin marca' },
    });
    const templateMatcher = makeTemplateMatcher({});
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['generic-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).not.toContain('BBVA:');
    expect(promptText).not.toContain('SBS:');
    expect(promptText).not.toContain('MAPFRE:');
  });

  it('injects addons for multiple insurers when multiple templates match', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-fake.pdf': { text: 'BBVA SEGUROS' },
      'sbs-fake.pdf': { text: 'SEGUROS SBS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
      'SEGUROS SBS': {
        templateId: 'sbs-pyme-v1',
        templateConfidence: 95,
        insurer: 'SBS',
        promptAddon: 'SBS addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-fake.pdf', 'sbs-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).toContain('BBVA:');
    expect(promptText).toContain('SBS:');
    expect(promptText).toContain('BBVA addon');
    expect(promptText).toContain('SBS addon');
  });

  it('skips an insurer addon when the measurement harness has disabled it', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-disabled-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness(new Set(['BBVA']));

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-disabled-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).not.toContain('BBVA:');
    expect(promptText).not.toContain('BBVA addon');
    expect(measurementHarness.shouldDisable).toHaveBeenCalledWith('BBVA');
  });

  it('records an observation per insurer that uses hints', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-record-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-record-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    expect(measurementHarness.recordObservation).toHaveBeenCalledWith(
      'BBVA',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('resolves compare() even when recordObservation never settles', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-hanging-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();
    measurementHarness.recordObservation = vi.fn(() => new Promise(() => {}));

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    const result = await engine.compare(['bbva-hanging-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(measurementHarness.recordObservation).toHaveBeenCalledWith(
      'BBVA',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('does not fail or delay compare() when recordObservation rejects', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-reject-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();
    measurementHarness.recordObservation = vi.fn(async () => {
      throw new Error('Redis unavailable');
    });

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await engine.compare(['bbva-reject-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });

    expect(result.insurers).toEqual(['MAPFRE', 'CHUBB']);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to record template hint observation for BBVA'),
      expect.anything()
    );

    warnSpy.mockRestore();
  });

  it('does not run template matching when templateHintsEnabled is false', async () => {
    mockGemini = buildMockGemini([validGranularJson]);
    const textExtractor = makeTextExtractor({
      'bbva-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: false,
    });

    expect(templateMatcher.matchTemplate).not.toHaveBeenCalled();
    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).not.toContain('BBVA:');
  });

  it('does not run template matching on the v1 schema path', async () => {
    mockGemini = buildMockGemini([validFlatJson]);
    const textExtractor = makeTextExtractor({
      'bbva-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    await engine.compare(['bbva-fake.pdf'], {
      granularComparisonSchema: false,
      templateHintsEnabled: true,
    });

    expect(templateMatcher.matchTemplate).not.toHaveBeenCalled();
    const promptCall = mockGemini.models.generateContent.mock.calls[0][0];
    const promptText = promptCall.contents[promptCall.contents.length - 1].text;
    expect(promptText).toContain('EXACTAMENTE estas filas');
    expect(promptText).not.toContain('BBVA:');
  });

  it('isolates cache entries by effective slice flags', async () => {
    mockGemini = buildMockGemini([validGranularJson, validGranularJson]);
    const textExtractor = makeTextExtractor({
      'shared-fake.pdf': { text: 'BBVA SEGUROS' },
    });
    const templateMatcher = makeTemplateMatcher({
      'BBVA SEGUROS': {
        templateId: 'bbva-pyme-v1',
        templateConfidence: 95,
        insurer: 'BBVA',
        promptAddon: 'BBVA addon',
        template: null,
      },
    });
    const measurementHarness = makeMeasurementHarness();

    const engine = new UnifiedComparisonEngine(
      { retryDelayMs: 0 },
      { textExtractor, templateMatcher, measurementHarness }
    );

    const withHints = await engine.compare(['shared-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: true,
    });
    expect(withHints.metadata.fromCache).toBe(false);

    const withoutHints = await engine.compare(['shared-fake.pdf'], {
      granularComparisonSchema: true,
      templateHintsEnabled: false,
    });
    expect(withoutHints.metadata.fromCache).toBe(false);

    // Different flag states must not share a cache entry.
    expect(mockGemini.models.generateContent).toHaveBeenCalledTimes(2);
  });
});

describe('UnifiedComparisonError', () => {
  it('should preserve reason, correlationId, and attempts', () => {
    const error = new UnifiedComparisonError('parse_failure', 'compare-123', 2);

    expect(error.message).toContain('parse_failure');
    expect(error.message).toContain('compare-123');
    expect(error.reason).toBe('parse_failure');
    expect(error.correlationId).toBe('compare-123');
    expect(error.attempts).toBe(2);
    expect(error.name).toBe('UnifiedComparisonError');
  });
});
