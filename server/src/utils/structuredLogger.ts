/**
 * Structured logging and lightweight metrics for backend services.
 *
 * The default sink writes JSON lines to stdout so log aggregation systems can
 * index the fields directly. Tests can inject an in-memory sink to assert on
 * emitted events without relying on console mocks.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  event: string;
  message: string;
  [key: string]: unknown;
}

export interface StructuredLoggerOptions {
  sink?: (entry: StructuredLogEntry) => void;
  /** Minimum level to emit. Default: debug in development, info otherwise. */
  minLevel?: LogLevel;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function defaultSink(entry: StructuredLogEntry): void {
  const serialized = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(serialized);
      break;
    case 'warn':
      console.warn(serialized);
      break;
    case 'debug':
      console.debug(serialized);
      break;
    default:
      console.log(serialized);
      break;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface StructuredLogger {
  debug(event: string, message: string, meta?: Record<string, unknown>): void;
  info(event: string, message: string, meta?: Record<string, unknown>): void;
  warn(event: string, message: string, meta?: Record<string, unknown>): void;
  error(event: string, message: string, meta?: Record<string, unknown>): void;
}

export function createStructuredLogger(
  service: string,
  options: StructuredLoggerOptions = {}
): StructuredLogger {
  const sink = options.sink ?? defaultSink;
  const minLevel = options.minLevel ?? (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

  function log(level: LogLevel, event: string, message: string, meta?: Record<string, unknown>) {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) {
      return;
    }

    sink({
      timestamp: nowIso(),
      level,
      service,
      event,
      message,
      ...(meta ?? {}),
    });
  }

  return {
    debug: (event, message, meta) => log('debug', event, message, meta),
    info: (event, message, meta) => log('info', event, message, meta),
    warn: (event, message, meta) => log('warn', event, message, meta),
    error: (event, message, meta) => log('error', event, message, meta),
  };
}

export interface MetricSnapshot {
  counters: Record<string, number>;
}

export interface MetricCollector {
  increment(name: string, tags?: Record<string, string | number | boolean>): void;
  snapshot(): MetricSnapshot;
}

function encodeTags(tags?: Record<string, string | number | boolean>): string {
  if (!tags) return '';
  const keys = Object.keys(tags).sort();
  if (keys.length === 0) return '';
  return keys.map((key) => `${key}=${tags[key]}`).join('|');
}

export function createMetricCollector(): MetricCollector {
  const counters = new Map<string, number>();

  return {
    increment(name, tags) {
      const tagPart = encodeTags(tags);
      const key = tagPart ? `${name}|${tagPart}` : name;
      counters.set(key, (counters.get(key) ?? 0) + 1);
    },

    snapshot(): MetricSnapshot {
      const result: Record<string, number> = {};
      for (const [key, value] of counters.entries()) {
        result[key] = value;
      }
      return {
        counters: new Proxy(result, {
          get(target, prop) {
            if (typeof prop === 'string' && !(prop in target)) {
              return 0;
            }
            return (target as unknown as Record<string | symbol, number>)[prop];
          },
        }) as Record<string, number>,
      };
    },
  };
}

/** Global process-level metrics for services that do not inject a collector. */
export const globalMetrics = createMetricCollector();
