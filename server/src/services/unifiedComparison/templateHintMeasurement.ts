/**
 * Template Hint Measurement Harness
 *
 * Per-insurer token and latency guardrail for template-aware prompts.
 * Stores observations in Redis (sorted sets) and baselines in a Redis hash,
 * evaluates p95 at request time, and caches a disable decision in memory with
 * TTL. All Redis failures are fail-open: the harness never blocks a request.
 */

import redis from '../cache/redisCache';
import {
  createStructuredLogger,
  globalMetrics,
  StructuredLogger,
  MetricCollector,
} from '../../utils/structuredLogger';

export interface Baseline {
  tokens: number;
  latencyMs: number;
}

export interface TemplateHintMeasurementHarness {
  recordObservation(insurer: string, tokenCount: number, latencyMs: number): Promise<void>;
  shouldDisable(
    insurer: string
  ): Promise<{ disabled: boolean; reason?: 'token_increase' | 'latency_increase' }>;
  setBaseline(insurer: string, baseline: Baseline): Promise<void>;
}

export interface RedisClientLike {
  hset(key: string, fields: Record<string, string | number>): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  pexpire(key: string, milliseconds: number): Promise<number>;
}

export interface RedisTemplateHintMeasurementHarnessOptions {
  redisClient?: RedisClientLike;
  windowMs?: number;
  observationTtlMs?: number;
  disableTtlMs?: number;
  logger?: StructuredLogger;
  metrics?: MetricCollector;
}

interface DisableEntry {
  disabled: boolean;
  reason?: 'token_increase' | 'latency_increase';
  expiresAt: number;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_OBSERVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_DISABLE_TTL_MS = 60 * 60 * 1000;

const BASELINE_KEY = (insurer: string) => `template_hint_baseline:${insurer.toUpperCase()}`;
const OBSERVATIONS_KEY = (insurer: string) => `template_hint_obs:${insurer.toUpperCase()}`;

export class RedisTemplateHintMeasurementHarness implements TemplateHintMeasurementHarness {
  private redisClient: RedisClientLike;
  private windowMs: number;
  private observationTtlMs: number;
  private disableTtlMs: number;
  private disableCache = new Map<string, DisableEntry>();
  private logger: StructuredLogger;
  private metrics: MetricCollector;

  constructor(options: RedisTemplateHintMeasurementHarnessOptions = {}) {
    this.redisClient = options.redisClient ?? redis;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.observationTtlMs = options.observationTtlMs ?? DEFAULT_OBSERVATION_TTL_MS;
    this.disableTtlMs = options.disableTtlMs ?? DEFAULT_DISABLE_TTL_MS;
    this.logger = options.logger ?? createStructuredLogger('templateHintMeasurement');
    this.metrics = options.metrics ?? globalMetrics;
  }

  async setBaseline(insurer: string, baseline: Baseline): Promise<void> {
    try {
      await this.redisClient.hset(BASELINE_KEY(insurer), {
        tokens: baseline.tokens,
        latencyMs: baseline.latencyMs,
      });
    } catch (error) {
      this.logger.warn('baseline_write_failed', 'Failed to write template hint baseline', {
        insurer,
        error: error instanceof Error ? error.message : String(error),
      });
      // fail-open: do not block requests because baseline could not be stored
    }
  }

  async recordObservation(insurer: string, tokenCount: number, latencyMs: number): Promise<void> {
    try {
      const now = Date.now();
      const member = JSON.stringify({ tokens: tokenCount, latencyMs });
      await this.redisClient.zadd(OBSERVATIONS_KEY(insurer), now, member);
      await this.redisClient.pexpire(OBSERVATIONS_KEY(insurer), this.observationTtlMs);
      this.metrics.increment('template_hint.observation_recorded', {
        insurer: insurer.toUpperCase(),
      });
    } catch (error) {
      this.logger.warn('observation_write_failed', 'Failed to record template hint observation', {
        insurer,
        error: error instanceof Error ? error.message : String(error),
      });
      // fail-open: missing observations do not disable hints
    }
  }

  async shouldDisable(
    insurer: string
  ): Promise<{ disabled: boolean; reason?: 'token_increase' | 'latency_increase' }> {
    const normalizedInsurer = insurer.toUpperCase();
    const now = Date.now();

    const cached = this.disableCache.get(normalizedInsurer);
    if (cached && cached.expiresAt > now) {
      return { disabled: cached.disabled, reason: cached.reason };
    }

    try {
      const baseline = await this.redisClient.hgetall(BASELINE_KEY(normalizedInsurer));
      if (!baseline.tokens || !baseline.latencyMs) {
        return { disabled: false };
      }

      const baselineTokens = Number(baseline.tokens);
      const baselineLatency = Number(baseline.latencyMs);
      if (Number.isNaN(baselineTokens) || Number.isNaN(baselineLatency)) {
        return { disabled: false };
      }

      const windowStart = now - this.windowMs;
      const observations = await this.redisClient.zrangebyscore(
        OBSERVATIONS_KEY(normalizedInsurer),
        windowStart,
        now
      );

      if (observations.length === 0) {
        return { disabled: false };
      }

      const tokenValues: number[] = [];
      const latencyValues: number[] = [];

      for (const observation of observations) {
        try {
          const parsed = JSON.parse(observation) as { tokens: number; latencyMs: number };
          tokenValues.push(parsed.tokens);
          latencyValues.push(parsed.latencyMs);
        } catch {
          // skip malformed observation
        }
      }

      if (tokenValues.length === 0 || latencyValues.length === 0) {
        return { disabled: false };
      }

      const tokenP95 = this.percentile(tokenValues, 0.95);
      const latencyP95 = this.percentile(latencyValues, 0.95);

      const tokenThreshold = baselineTokens * 1.15;
      const latencyThreshold = baselineLatency * 1.15;

      if (tokenP95 > tokenThreshold) {
        this.logger.info(
          'template_hints_disabled',
          `Template hints disabled for ${normalizedInsurer}`,
          {
            insurer: normalizedInsurer,
            reason: 'token_increase',
            baselineTokens,
            tokenP95,
            threshold: tokenThreshold,
          }
        );
        this.metrics.increment('template_hints_disabled', {
          insurer: normalizedInsurer,
          reason: 'token_increase',
        });
        const entry: DisableEntry = {
          disabled: true,
          reason: 'token_increase',
          expiresAt: now + this.disableTtlMs,
        };
        this.disableCache.set(normalizedInsurer, entry);
        return { disabled: true, reason: 'token_increase' };
      }

      if (latencyP95 > latencyThreshold) {
        this.logger.info(
          'template_hints_disabled',
          `Template hints disabled for ${normalizedInsurer}`,
          {
            insurer: normalizedInsurer,
            reason: 'latency_increase',
            baselineLatency,
            latencyP95,
            threshold: latencyThreshold,
          }
        );
        this.metrics.increment('template_hints_disabled', {
          insurer: normalizedInsurer,
          reason: 'latency_increase',
        });
        const entry: DisableEntry = {
          disabled: true,
          reason: 'latency_increase',
          expiresAt: now + this.disableTtlMs,
        };
        this.disableCache.set(normalizedInsurer, entry);
        return { disabled: true, reason: 'latency_increase' };
      }

      return { disabled: false };
    } catch (error) {
      this.logger.warn(
        'disable_check_failed',
        'Failed to evaluate template hint disable guardrail',
        {
          insurer: normalizedInsurer,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      // fail-open: do not disable when Redis is unavailable
      return { disabled: false };
    }
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

export function createTemplateHintMeasurementHarness(
  options?: RedisTemplateHintMeasurementHarnessOptions
): TemplateHintMeasurementHarness {
  return new RedisTemplateHintMeasurementHarness(options);
}

export const templateHintMeasurementHarness = createTemplateHintMeasurementHarness();
