import { describe, it, expect, vi } from 'vitest';
import { createExtractionMetricsEmitter } from '../../server/src/services/extractionMetrics';
import type { ExtractionMetrics } from '../../server/src/types/extractionMetrics';

describe('createExtractionMetricsEmitter', () => {
  it('collects emitted events and returns them via snapshot', () => {
    const emitter = createExtractionMetricsEmitter();

    emitter.emit({
      quoteId: 'quote-1',
      index: 0,
      total: 2,
      result: 'success',
      path: 'v2',
      insurer: 'SBS',
      formatFamily: 'TABLE-DOUBLE',
    });

    const snapshot = emitter.snapshot();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].quoteId).toBe('quote-1');
    expect(snapshot[0].index).toBe(0);
    expect(snapshot[0].total).toBe(2);
    expect(snapshot[0].result).toBe('success');
  });

  it('calls a custom sink for every emit', () => {
    const sink = vi.fn();
    const emitter = createExtractionMetricsEmitter(sink);

    emitter.emit({ quoteId: 'q1', index: 0, total: 1, result: 'success' });
    emitter.emit({ quoteId: 'q2', index: 1, total: 2, result: 'failed' });

    expect(sink).toHaveBeenCalledTimes(2);
    const first = sink.mock.calls[0][0] as ExtractionMetrics;
    expect(first.quoteId).toBe('q1');
    expect(first.result).toBe('success');
    const second = sink.mock.calls[1][0] as ExtractionMetrics;
    expect(second.quoteId).toBe('q2');
    expect(second.result).toBe('failed');
  });

  it('merges multiple events for the same quoteId', () => {
    const emitter = createExtractionMetricsEmitter();

    emitter.emit({ quoteId: 'q1', index: 0, total: 1, insurer: 'BBVA' });
    emitter.emit({ quoteId: 'q1', formatFamily: 'SECTIONS', path: 'v2' });
    emitter.emit({
      quoteId: 'q1',
      result: 'success',
      durationMs: 1234,
      rawCoverageCount: 12,
      canonicalCoverageCount: 14,
    });

    const snapshot = emitter.snapshot();
    expect(snapshot).toHaveLength(1);

    const event = snapshot[0];
    expect(event.insurer).toBe('BBVA');
    expect(event.formatFamily).toBe('SECTIONS');
    expect(event.path).toBe('v2');
    expect(event.result).toBe('success');
    expect(event.durationMs).toBe(1234);
    expect(event.rawCoverageCount).toBe(12);
    expect(event.canonicalCoverageCount).toBe(14);
  });

  it('keeps separate events for different quoteIds', () => {
    const emitter = createExtractionMetricsEmitter();

    emitter.emit({ quoteId: 'q1', index: 0, total: 2, result: 'success' });
    emitter.emit({ quoteId: 'q2', index: 1, total: 2, result: 'failed' });

    const snapshot = emitter.snapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot.map((e) => e.quoteId)).toContain('q1');
    expect(snapshot.map((e) => e.quoteId)).toContain('q2');
  });

  it('does not crash the quote when the sink throws', () => {
    const sink = vi.fn().mockImplementation(() => {
      throw new Error('sink failed');
    });
    const emitter = createExtractionMetricsEmitter(sink);

    expect(() => {
      emitter.emit({ quoteId: 'q1', index: 0, total: 1, result: 'success' });
    }).not.toThrow();
  });
});
