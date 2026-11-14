import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RateLimitError } from '../errors';
import logger from '../config/logger';
import { redis as redisClient } from '../services/cache/redisCache';

const createStore = () => {
  if (process.env.REDIS_URL) {
    return new RedisStore({
      sendCommand: (...args: string[]) => (redisClient as any).call(...args),
    });
  }
  return undefined; // Falls back to default memory store
};

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  handler: (_req, _res, _next, options) => {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 60000)} minutes.`,
      Math.ceil(options.windowMs / 1000)
    );
  },
});

export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  handler: (_req, _res, _next, options) => {
    throw new RateLimitError(
      `Analysis rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 1000)} seconds.`,
      Math.ceil(options.windowMs / 1000)
    );
  },
});

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  handler: (_req, _res, _next, options) => {
    throw new RateLimitError(
      `Chat rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 1000)} seconds.`,
      Math.ceil(options.windowMs / 1000)
    );
  },
});

// Graceful shutdown handlers
const cleanup = async () => {
  logger.info('🧹 Cleaning up Redis connection...');
  if (redisClient.status === 'ready') {
    await redisClient.quit();
  }
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

export { redisClient };
