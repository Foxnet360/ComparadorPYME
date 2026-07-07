import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTemplateRegistryService,
  StructuredLogEntry,
  MetricCollector,
} from '../templateRegistryService';
import { createStructuredLogger, createMetricCollector } from '../../utils/structuredLogger';

const bbvaText = `BBVA SEGUROS
COT-2026-001
COBERTURAS / DEDUCIBLE
Todo Riesgo Daño Material`;

const unknownText = `Aseguradora Desconocida SA
Cobertura generica sin marcadores`;

describe('templateRegistryService metrics and logging', () => {
  let entries: StructuredLogEntry[];
  let metrics: MetricCollector;
  let logger: ReturnType<typeof createStructuredLogger>;

  beforeEach(() => {
    entries = [];
    metrics = createMetricCollector();
    logger = createStructuredLogger('templateRegistryService', {
      sink: (entry) => entries.push(entry),
    });
  });

  it('logs template_match and increments the match counter on a successful match', async () => {
    const service = createTemplateRegistryService({ logger, metrics });

    const result = await service.matchTemplate({ text: bbvaText, domain: 'pyme' });

    expect(result.templateId).toBe('bbva-pyme-v1');
    const matchLog = entries.find((e) => e.event === 'template_match');
    expect(matchLog).toBeDefined();
    expect(matchLog?.templateId).toBe('bbva-pyme-v1');
    expect(matchLog?.confidence).toBeGreaterThanOrEqual(90);
    expect(
      metrics.snapshot().counters['templateRegistry.match|domain=pyme|templateId=bbva-pyme-v1']
    ).toBe(1);
  });

  it('logs template_miss and increments the miss counter when nothing matches', async () => {
    const service = createTemplateRegistryService({ logger, metrics });

    const result = await service.matchTemplate({ text: unknownText, domain: 'pyme' });

    expect(result.templateId).toBeNull();
    const missLog = entries.find((e) => e.event === 'template_miss');
    expect(missLog).toBeDefined();
    expect(metrics.snapshot().counters['templateRegistry.miss|domain=pyme']).toBe(1);
  });

  it('logs schema_validation_failed when validatePayload rejects a payload', async () => {
    const service = createTemplateRegistryService({ logger, metrics });
    await service.loadTemplates('pyme');

    service.validatePayload('bbva-pyme-v1', { coverages: [{ rawName: 'X' }] }, 'pyme');

    const failLog = entries.find((e) => e.event === 'schema_validation_failed');
    expect(failLog).toBeDefined();
    expect(failLog?.templateId).toBe('bbva-pyme-v1');
    expect(failLog?.level).toBe('warn');
    expect(
      metrics.snapshot().counters[
        'templateRegistry.schema_validation_failed|domain=pyme|templateId=bbva-pyme-v1'
      ]
    ).toBe(1);
  });

  it('logs cache_refresh when the cache is refreshed', async () => {
    const service = createTemplateRegistryService({ logger, metrics });

    await service.refreshCache('pyme');

    const refreshLog = entries.find((e) => e.event === 'cache_refresh');
    expect(refreshLog).toBeDefined();
    expect(refreshLog?.domain).toBe('pyme');
  });

  it('uses default logger and metrics when none are injected', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const service = createTemplateRegistryService();

    await service.matchTemplate({ text: bbvaText, domain: 'pyme' });

    expect(consoleSpy).toHaveBeenCalled();
    const parsed = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsed.service).toBe('templateRegistryService');

    consoleSpy.mockRestore();
  });
});
