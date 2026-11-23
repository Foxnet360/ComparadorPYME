import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RateLimitError } from '../errors';
import logger from '../config/logger';
import {
  redis as redisClient,
  zaddRedisCache,
  zrangebyscoreRedisCache,
  pexpireRedisCache,
} from '../services/cache/redisCache';
import type { AuthenticatedRequest } from './auth';

const createStore = (prefix: string) => {
  if (process.env.REDIS_URL) {
    return new RedisStore({
      prefix,
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
  // B2B DaaS traffic has its own per-subscriber per-minute limiter so
  // ENTERPRISE subscribers (600 req/min) behind shared NAT are not throttled at 100/15min.
  // Async job status/SSE polling (GET /*/analysis/jobs/*) is already auth-gated and lightweight.
  skip: (req: Request) =>
    req.path.startsWith('/v1/daas') ||
    req.originalUrl.startsWith('/api/v1/daas') ||
    (req.method === 'GET' && /^\/(?:v1\/)?analysis\/jobs\//.test(req.path)),
  store: createStore('rl:global:'),
  handler: (_req, _res, _next, options) => {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 60000)} minutes.`,
      Math.ceil(options.windowMs / 1000)
    );
  },
});

/**
 * Per-subscriber per-minute limiter for /api/v1/daas/* backed by Redis with
 * transparent MemoryCache fallback. Must run after daasApiKeyAuth.
 */
export const daasSubscriberRateLimiter = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const subscriber = req.subscriber;
  if (!subscriber) {
    next();
    return;
  }

  try {
    const limit = Math.max(1, subscriber.rateLimitPerMinute || 60);
    const now = Date.now();
    const minuteBucket = Math.floor(now / 60_000);
    const resetUnixSeconds = (minuteBucket + 1) * 60;
    const key = `rl:daas:sub:${subscriber.id}:${minuteBucket}`;

    await zaddRedisCache(key, now, `${now}:${crypto.randomUUID()}`);
    await pexpireRedisCache(key, 65_000);
    const entries = await zrangebyscoreRedisCache(key, 0, now + 60_000);
    const count = entries.length;
    const remaining = Math.max(0, limit - count);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetUnixSeconds);

    if (count > limit) {
      const retryAfterSeconds = Math.max(1, resetUnixSeconds - Math.floor(now / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `Per-minute DaaS rate limit (${limit} req/min) exceeded. Retry after ${retryAfterSeconds}s.`,
      });
      return;
    }

    next();
  } catch (error) {
    logger.warn({ err: error, subscriberId: subscriber.id }, 'DaaS subscriber rate limiter error');
    next();
  }
};

export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Async job polling, SSE event streams, and cancellation must not consume the heavy-compute quota
  skip: (req: Request) =>
    req.path.startsWith('/jobs/') || /^\/(?:v1\/)?analysis\/jobs\//.test(req.path),
  store: createStore('rl:analyze:'),
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
  store: createStore('rl:chat:'),
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
