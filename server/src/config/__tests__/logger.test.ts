import { describe, it, expect } from 'vitest';

import { buildLogger, createTraceLogger } from '../logger';

/**
 * ERR-2: server logs must be structured (pino). In production every log line
 * is single-line JSON carrying level, message and the bound traceId so log
 * aggregation can index the fields directly.
 */

interface LogLineSink {
  lines: string[];
  write(msg: string): void;
}

function createSink(): LogLineSink {
  const lines: string[] = [];
  return {
    lines,
    write(msg: string) {
      lines.push(msg);
    },
  };
}

describe('structured logger (ERR-2)', () => {
  it('emits single-line JSON with level, message and traceId', () => {
    const sink = createSink();
    const logger = buildLogger({ stream: sink, pretty: false, level: 'info' });

    logger.child({ traceId: 'trace-json-1' }).error('analysis failed');

    expect(sink.lines).toHaveLength(1);
    const entry = JSON.parse(sink.lines[0]!);
    expect(entry).toMatchObject({
      level: 50, // pino error
      msg: 'analysis failed',
      traceId: 'trace-json-1',
    });
    expect(typeof entry.time).toBe('number');
  });

  it('binds the traceId to every entry of a child logger', () => {
    const sink = createSink();
    const logger = buildLogger({ stream: sink, pretty: false, level: 'debug' });
    const traceLogger = logger.child({ traceId: 'trace-child-2' });

    traceLogger.info('step one');
    traceLogger.warn('step two');

    expect(sink.lines).toHaveLength(2);
    for (const line of sink.lines) {
      expect(JSON.parse(line)).toMatchObject({ traceId: 'trace-child-2' });
    }
    expect(JSON.parse(sink.lines[0]!)).toMatchObject({ level: 30, msg: 'step one' });
    expect(JSON.parse(sink.lines[1]!)).toMatchObject({ level: 40, msg: 'step two' });
  });

  it('exposes a createTraceLogger helper that binds traceId', () => {
    const traceLogger = createTraceLogger('trace-helper-3');

    // In the test environment the default logger is silent; assert the pino
    // child bindings instead of capturing stdout.
    const bindings = traceLogger.bindings();
    expect(bindings).toMatchObject({ traceId: 'trace-helper-3' });
  });
});
