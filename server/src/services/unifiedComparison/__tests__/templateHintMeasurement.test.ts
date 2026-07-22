import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RedisTemplateHintMeasurementHarness,
  createTemplateHintMeasurementHarness,
  type RedisClientLike,
} from '../templateHintMeasurement';

function makeFakeRedis(): RedisClientLike {
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, Array<{ score: number; member: string }>>();

  return {
    hset: vi.fn(async (key: string, fields: Record<string, string | number>) => {
      if (!hashes.has(key)) hashes.set(key, new Map());
      const h = hashes.get(key)!;
      let added = 0;
      for (const [field, value] of Object.entries(fields)) {
        if (!h.has(field)) added++;
        h.set(field, String(value));
      }
      return added;
    }),
    hgetall: vi.fn(async (key: string) => {
      const h = hashes.get(key);
      if (!h) return {};
      const result: Record<string, string> = {};
      for (const [field, value] of h.entries()) {
        result[field] = value;
      }
      return result;
    }),
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!zsets.has(key)) zsets.set(key, []);
      const list = zsets.get(key)!;
      const existing = list.find((item) => item.member === member);
      if (existing) {
        existing.score = score;
        return 0;
      }
      list.push({ score, member });
      return 1;
    }),
    zrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      const list = zsets.get(key) ?? [];
      return list
        .filter((item) => item.score >= min && item.score <= max)
        .map((item) => item.member);
    }),
    pexpire: vi.fn(async () => 1),
  };
}

function makeFailingRedis(): RedisClientLike {
  return {
    hset: vi.fn(async () => {
      throw new Error('Redis down');
    }),
    hgetall: vi.fn(async () => {
      throw new Error('Redis down');
    }),
    zadd: vi.fn(async () => {
      throw new Error('Redis down');
    }),
    zrangebyscore: vi.fn(async () => {
      throw new Error('Redis down');
    }),
    pexpire: vi.fn(async () => {
      throw new Error('Redis down');
    }),
  };
}

describe('RedisTemplateHintMeasurementHarness', () => {
  let redis: RedisClientLike;
  let harness: RedisTemplateHintMeasurementHarness;

  beforeEach(() => {
    redis = makeFakeRedis();
    harness = new RedisTemplateHintMeasurementHarness({ redisClient: redis, disableTtlMs: 60_000 });
  });

  it('returns disabled=false when no baseline exists', async () => {
    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('does not disable on a single outlier with N=1', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    await harness.recordObservation('BBVA', 9999, 99999);

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('does not disable with fewer than 10 observations even if all are outliers', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 9; i++) {
      await harness.recordObservation('BBVA', 1300 + i, 8000 + i);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('disables once the minimum sample size of 10 is reached', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 10; i++) {
      await harness.recordObservation('BBVA', 1300 + i, 8000 + i);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe('token_increase');
  });

  it('does not treat the maximum observation as the p95 for small N', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 9; i++) {
      await harness.recordObservation('BBVA', 1000, 8000 + i);
    }
    await harness.recordObservation('BBVA', 1200, 8010);

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('records observations in Redis', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    await harness.recordObservation('BBVA', 1100, 8500);

    expect(redis.zadd).toHaveBeenCalledWith(
      expect.stringContaining('template_hint_obs:BBVA'),
      expect.any(Number),
      expect.any(String)
    );
  });

  it('disables when token p95 exceeds 15% over baseline', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1100 + i * 10, 8000);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe('token_increase');
  });

  it('disables when latency p95 exceeds 15% over baseline', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1000, 9200 + i * 10);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe('latency_increase');
  });

  it('does not disable when p95 stays below 15% threshold', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1100, 8800);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
  });

  it('caches the disable decision in memory for the configured TTL', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1300, 8000 + i);
    }

    const first = await harness.shouldDisable('BBVA');
    expect(first.disabled).toBe(true);

    const second = await harness.shouldDisable('BBVA');
    expect(second).toEqual(first);

    expect(redis.hgetall).toHaveBeenCalledTimes(1);
    expect(redis.zrangebyscore).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates after setBaseline invalidates the cached disable decision', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1300, 8000 + i);
    }

    const first = await harness.shouldDisable('BBVA');
    expect(first.disabled).toBe(true);

    await harness.setBaseline('BBVA', { tokens: 2000, latencyMs: 8000 });

    const second = await harness.shouldDisable('BBVA');
    expect(second.disabled).toBe(false);
    expect(second.reason).toBeUndefined();

    expect(redis.hgetall).toHaveBeenCalledTimes(2);
    expect(redis.zrangebyscore).toHaveBeenCalledTimes(2);
  });

  it('returns disabled=false when Redis is unavailable (fail-open)', async () => {
    const failingHarness = new RedisTemplateHintMeasurementHarness({
      redisClient: makeFailingRedis(),
    });

    await failingHarness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    await failingHarness.recordObservation('BBVA', 9999, 99999);

    const result = await failingHarness.shouldDisable('BBVA');
    expect(result.disabled).toBe(false);
  });

  it('uses the resilient redisCache wrapper as the default client', async () => {
    const defaultHarness = createTemplateHintMeasurementHarness({ disableTtlMs: 60_000 });
    await defaultHarness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    for (let i = 0; i < 20; i++) {
      await defaultHarness.recordObservation('BBVA', 1300, 8000 + i);
    }

    const result = await defaultHarness.shouldDisable('BBVA');
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe('token_increase');
  });

  it('isolates insurers so one insurer does not disable another', async () => {
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });
    await harness.setBaseline('SBS', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1300, 8000 + i);
      await harness.recordObservation('SBS', 1000, 8000 + i);
    }

    const bbva = await harness.shouldDisable('BBVA');
    const sbs = await harness.shouldDisable('SBS');

    expect(bbva.disabled).toBe(true);
    expect(sbs.disabled).toBe(false);
  });

  it('only considers observations inside the configured time window', async () => {
    const now = Date.now();
    await harness.setBaseline('BBVA', { tokens: 1000, latencyMs: 8000 });

    for (let i = 0; i < 20; i++) {
      await harness.recordObservation('BBVA', 1300, 8000 + i);
    }

    const result = await harness.shouldDisable('BBVA');
    expect(result.disabled).toBe(true);
  });
});
