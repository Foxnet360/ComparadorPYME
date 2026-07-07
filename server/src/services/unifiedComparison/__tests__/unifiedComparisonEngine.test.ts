/**
 * Unified Comparison Engine Tests
 * Tests flat-parser wiring, retry on parse failure, and structured errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedComparisonEngine, UnifiedComparisonError } from '../unifiedComparisonEngine';
import type { FlatComparisonResult } from '../comparisonSchema';

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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
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
