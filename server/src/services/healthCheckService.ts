import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import WebSocket from 'ws';

interface ServiceHealth {
  status: 'ok' | 'error';
  latency: number;
  message?: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    gemini: ServiceHealth;
    supabase: ServiceHealth;
    redis?: ServiceHealth;
  };
}

let lastHealthCheck: HealthStatus | null = null;
let lastCheckTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function checkHealth(): Promise<HealthStatus> {
  const now = Date.now();

  // Return cached result if within cache duration
  if (lastHealthCheck && now - lastCheckTime < CACHE_DURATION) {
    return lastHealthCheck;
  }

  const services: HealthStatus['services'] = {
    gemini: await checkGemini(),
    supabase: await checkSupabase(),
  };

  // Only check Redis if configured
  if (process.env.REDIS_URL) {
    services.redis = await checkRedis();
  }

  // Determine overall status
  const hasErrors = Object.values(services).some((s) => s.status === 'error');
  const allErrors = Object.values(services).every((s) => s.status === 'error');

  const status: HealthStatus['status'] = allErrors
    ? 'unhealthy'
    : hasErrors
      ? 'degraded'
      : 'healthy';

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    services,
  };

  // Cache the result
  lastHealthCheck = healthStatus;
  lastCheckTime = now;

  return healthStatus;
}

async function checkGemini(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 'error', latency: 0, message: 'GEMINI_API_KEY not configured' };
    }

    const genAI = new GoogleGenAI({ apiKey });
    // Try to list models as a lightweight check
    await genAI.models.list({});

    return { status: 'ok', latency: Date.now() - start };
  } catch (error: unknown) {
    return {
      status: 'error',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Failed to connect to Gemini API',
    };
  }
}

async function checkSupabase(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return { status: 'error', latency: 0, message: 'Supabase credentials not configured' };
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as any },
    });
    const { error } = await supabase.rpc('select 1');

    if (error) {
      // Try alternative health check
      const { error: pingError } = await supabase
        .from('documents')
        .select('count', { count: 'exact', head: true });
      if (pingError) {
        throw pingError;
      }
    }

    return { status: 'ok', latency: Date.now() - start };
  } catch (error: unknown) {
    return {
      status: 'error',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Failed to connect to Supabase',
    };
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      return { status: 'error', latency: 0, message: 'REDIS_URL not configured' };
    }

    // Dynamic import to avoid requiring Redis if not used
    const { Redis } = await import('ioredis');
    const redis = new Redis(redisUrl, { connectTimeout: 5000 });

    await redis.ping();
    await redis.quit();

    return { status: 'ok', latency: Date.now() - start };
  } catch (error: unknown) {
    return {
      status: 'error',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Failed to connect to Redis',
    };
  }
}

export function invalidateHealthCache(): void {
  lastHealthCheck = null;
  lastCheckTime = 0;
}
