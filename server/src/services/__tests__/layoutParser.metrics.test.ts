import { describe, it, expect, beforeEach } from 'vitest';
import { extractTables, LayoutPage, LayoutTextItem } from '../layoutParser';
import {
  createStructuredLogger,
  createMetricCollector,
  StructuredLogEntry,
  MetricCollector,
} from '../../utils/structuredLogger';

function item(
  text: string,
  x: number,
  y: number,
  width = 60,
  height = 12,
  rotation = 0
): LayoutTextItem {
  return { text, x, y, width, height, rotation };
}

function page(pageNumber: number, items: LayoutTextItem[]): LayoutPage {
  return { page: pageNumber, items };
}

describe('layoutParser metrics and logging', () => {
  let entries: StructuredLogEntry[];
  let metrics: MetricCollector;
  let logger: ReturnType<typeof createStructuredLogger>;

  beforeEach(() => {
    entries = [];
    metrics = createMetricCollector();
    logger = createStructuredLogger('layoutParser', {
      sink: (entry) => entries.push(entry),
    });
  });

  it('logs layout_parse_success and increments the success counter on a valid table', () => {
    const items = [
      item('Cobertura', 100, 700),
      item('Suma', 260, 700),
      item('Incendio', 100, 680),
      item('$ 100', 260, 680),
    ];

    const result = extractTables([page(1, items)], { logger, metrics });

    expect(result.failed).toBe(false);
    expect(result.tables).toHaveLength(1);
    const successLog = entries.find((e) => e.event === 'layout_parse_success');
    expect(successLog).toBeDefined();
    expect(successLog?.page).toBe(1);
    expect(successLog?.tableCount).toBe(1);
    expect(metrics.snapshot().counters['layoutParser.success|page=1']).toBe(1);
  });

  it('logs layout_parse_failed and increments the failure counter on empty pages', () => {
    const result = extractTables([page(1, [])], { logger, metrics });

    expect(result.failed).toBe(true);
    const failLog = entries.find((e) => e.event === 'layout_parse_failed');
    expect(failLog).toBeDefined();
    expect(failLog?.reason).toContain('No text items');
    expect(failLog?.level).toBe('warn');
    expect(metrics.snapshot().counters['layoutParser.failure|reason=empty']).toBe(1);
  });

  it('logs layout_parse_failed when rotated pages are detected', () => {
    const items = [item('Rotado A', 100, 700, 60, 12, 90), item('Rotado B', 100, 680, 60, 12, 90)];

    const result = extractTables([page(1, items)], { logger, metrics });

    expect(result.failed).toBe(true);
    expect(result.rotatedPages).toContain(1);
    const failLog = entries.find((e) => e.event === 'layout_parse_failed');
    expect(failLog?.reason).toContain('rotated');
    expect(metrics.snapshot().counters['layoutParser.failure|reason=rotation']).toBe(1);
  });

  it('logs layout_parse_failed when too few columns are detected', () => {
    const items = [item('Seccion', 100, 700), item('Valor', 100, 680)];

    const result = extractTables([page(1, items)], { logger, metrics });

    expect(result.failed).toBe(true);
    const failLog = entries.find((e) => e.event === 'layout_parse_failed');
    expect(failLog?.reason).toContain('columns');
    expect(metrics.snapshot().counters['layoutParser.failure|reason=insufficient_columns']).toBe(1);
  });
});
