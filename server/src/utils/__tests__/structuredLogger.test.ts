import { describe, it, expect, vi } from 'vitest';
import {
  createStructuredLogger,
  createMetricCollector,
  StructuredLogEntry,
} from '../structuredLogger';

describe('structuredLogger', () => {
  describe('createStructuredLogger', () => {
    it('emits an info entry with service, event, and metadata', () => {
      const entries: StructuredLogEntry[] = [];
      const logger = createStructuredLogger('test-service', {
        sink: (entry) => entries.push(entry),
      });

      logger.info('template_match', 'Template matched', {
        templateId: 'bbva-pyme-v1',
        confidence: 95,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].service).toBe('test-service');
      expect(entries[0].event).toBe('template_match');
      expect(entries[0].message).toBe('Template matched');
      expect(entries[0].templateId).toBe('bbva-pyme-v1');
      expect(entries[0].confidence).toBe(95);
      expect(typeof entries[0].timestamp).toBe('string');
    });

    it('emits warn and error entries at the correct levels', () => {
      const entries: StructuredLogEntry[] = [];
      const logger = createStructuredLogger('test-service', {
        sink: (entry) => entries.push(entry),
      });

      logger.warn('layout_parse_failed', 'No tables found', { reason: 'rotated' });
      logger.error('graph_query_failed', 'DB unreachable', { error: 'timeout' });

      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('defaults to console when no sink is provided', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createStructuredLogger('default-service');

      logger.info('test_event', 'hello');

      expect(consoleSpy).toHaveBeenCalledOnce();
      const entry = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(entry.service).toBe('default-service');
      expect(entry.event).toBe('test_event');

      consoleSpy.mockRestore();
    });
  });

  describe('createMetricCollector', () => {
    it('increments a counter and returns a snapshot', () => {
      const metrics = createMetricCollector();

      metrics.increment('template.match');
      metrics.increment('template.match');
      metrics.increment('template.miss');

      const snapshot = metrics.snapshot();
      expect(snapshot.counters['template.match']).toBe(2);
      expect(snapshot.counters['template.miss']).toBe(1);
    });

    it('serializes tags into the counter key', () => {
      const metrics = createMetricCollector();

      metrics.increment('graph.query', { source: 'cache' });
      metrics.increment('graph.query', { source: 'db' });
      metrics.increment('graph.query', { source: 'cache' });

      const snapshot = metrics.snapshot();
      expect(snapshot.counters['graph.query|source=cache']).toBe(2);
      expect(snapshot.counters['graph.query|source=db']).toBe(1);
    });

    it('returns zero for counters that have never been incremented', () => {
      const metrics = createMetricCollector();
      expect(metrics.snapshot().counters['never.seen']).toBe(0);
    });
  });
});
