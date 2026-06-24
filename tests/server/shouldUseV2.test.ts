import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { shouldUseV2, isMultimodalEnabled } from '../../server/src/services/quoteProcessingService';
import { featureFlags } from '../../server/src/config/featureFlags';
import type { NativeTextResult } from '../../server/src/services/quoteProcessingService';

describe('shouldUseV2 path selection', () => {
  function makeFile(): Express.Multer.File {
    return {
      fieldname: 'quotes',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1234,
      destination: '/tmp',
      filename: 'test.pdf',
      path: '/tmp/test.pdf',
      buffer: Buffer.from(''),
    } as Express.Multer.File;
  }

  function makeNativeTextResult(overrides?: Partial<NativeTextResult>): NativeTextResult {
    return {
      text: 'COTIZACION SEGUROS',
      pageTextMap: { 1: 'COTIZACION SEGUROS' },
      metadata: { pageCount: 1 },
      isScanned: false,
      ...overrides,
    } as NativeTextResult;
  }

  it('returns true for a non-scanned PDF when multimodal is enabled', () => {
    process.env.ENABLE_MULTIMODAL_EXTRACTION = 'true';
    expect(shouldUseV2(makeFile(), makeNativeTextResult())).toBe(true);
  });

  it('returns false for a scanned PDF even when multimodal is enabled', () => {
    process.env.ENABLE_MULTIMODAL_EXTRACTION = 'true';
    expect(shouldUseV2(makeFile(), makeNativeTextResult({ isScanned: true }))).toBe(false);
  });

  beforeEach(() => {
    featureFlags.updateFlag('enableMultimodalExtraction', true);
  });

  afterEach(() => {
    featureFlags.updateFlag('enableMultimodalExtraction', true);
  });

  it('returns false when multimodal extraction is disabled', () => {
    featureFlags.updateFlag('enableMultimodalExtraction', false);
    expect(shouldUseV2(makeFile(), makeNativeTextResult())).toBe(false);
  });

  it('isMultimodalEnabled reflects the feature flag', () => {
    featureFlags.updateFlag('enableMultimodalExtraction', true);
    expect(isMultimodalEnabled()).toBe(true);
    featureFlags.updateFlag('enableMultimodalExtraction', false);
    expect(isMultimodalEnabled()).toBe(false);
  });
});
