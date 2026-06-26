import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment 
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
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.apiKey', '*.api_key', '*.secret'],
    remove: true,
  },
});

// Helper to create child loggers with context
export const createLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

// Disable logging in tests unless explicitly enabled
if (isTest && !process.env.ENABLE_TEST_LOGS) {
  logger.level = 'silent';
}

export default logger;
