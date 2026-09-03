import pino from 'pino';

export interface BuildLoggerOptions {
  /** Custom destination (defaults to stdout). Tests pass an in-memory sink. */
  stream?: pino.DestinationStream;
  /** Pretty-print in development; force off to assert production JSON output. */
  pretty?: boolean;
  level?: string;
}

export function buildLogger(options: BuildLoggerOptions = {}) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const usePretty = options.pretty ?? isDevelopment;

  const loggerOptions: pino.LoggerOptions = {
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    transport: usePretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
    base: {
      pid: process.pid,
      env: process.env.NODE_ENV || 'development',
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.apiKey',
        '*.api_key',
        '*.secret',
      ],
      remove: true,
    },
  };

  return options.stream ? pino(loggerOptions, options.stream) : pino(loggerOptions);
}

const logger = buildLogger();

// Helper to create child loggers with context
export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// ERR-2: helper that binds a traceId to every log entry of the child logger
export const createTraceLogger = (traceId: string) => logger.child({ traceId });

// Disable logging in tests unless explicitly enabled
if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_LOGS) {
  logger.level = 'silent';
}

export default logger;
