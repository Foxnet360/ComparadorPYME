/**
 * DaaS API Key Authentication Middleware
 * Validates B2B institutional API keys for external consumers (insurers, reinsurers, actuaries).
 * Computes SHA-256 hash of API key and checks against public.daas_subscribers.
 */

import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from './auth';
import { supabase } from '../config/database';

export interface DaasSubscriber {
  id: string;
  name: string;
  tier: 'TIER_1' | 'TIER_2' | 'ENTERPRISE';
  monthlyQuota: number;
  currentMonthUsage: number;
  rateLimitPerMinute: number;
  allowedDomains: string[];
}

declare module './auth' {
  interface AuthenticatedRequest {
    subscriber?: DaasSubscriber;
  }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

export const daasApiKeyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract API Key from X-API-Key or Bearer token
    let rawKey = req.headers['x-api-key'] as string | undefined;

    if (!rawKey && req.headers.authorization) {
      const auth = req.headers.authorization;
      if (auth.startsWith('Bearer csa_')) {
        rawKey = auth.substring(7);
      }
    }

    if (!rawKey) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'DaaS API Key required. Supply via X-API-Key header or Bearer csa_... token',
      });
      return;
    }

    const keyHash = hashApiKey(rawKey);

    // 2. Validate against public.daas_subscribers
    let subscriber: DaasSubscriber | null = null;

    try {
      const { data, error } = await supabase.rpc('verify_daas_api_key', {
        p_key_hash: keyHash,
      });

      if (!error && Array.isArray(data) && data.length > 0 && data[0]?.is_valid) {
        const row = data[0];
        if (row) {
          subscriber = {
            id: row.subscriber_id,
            name: row.name,
            tier: row.tier as 'TIER_1' | 'TIER_2' | 'ENTERPRISE',
            monthlyQuota: row.monthly_quota,
            currentMonthUsage: row.current_month_usage,
            rateLimitPerMinute: row.rate_limit_per_minute,
            allowedDomains: row.allowed_domains || ['all'],
          };
        }
      }
    } catch {
      // Direct table query fallback below
    }

    if (!subscriber) {
      const { data: rows } = await supabase
        .from('daas_subscribers')
        .select('*')
        .eq('api_key_hash', keyHash)
        .eq('status', 'ACTIVE');

      const row = rows && rows[0];
      if (row) {
        subscriber = {
          id: row.id,
          name: row.name,
          tier: row.tier,
          monthlyQuota: row.monthly_quota || 1000,
          currentMonthUsage: (row.current_month_usage || 0) + 1,
          rateLimitPerMinute: row.rate_limit_per_minute || 60,
          allowedDomains: row.allowed_domains || ['all'],
        };
      }
    }

    if (!subscriber) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid, expired or suspended DaaS API Key',
      });
      return;
    }

    // 3. Quota check
    if (subscriber.currentMonthUsage > subscriber.monthlyQuota) {
      res.status(429).json({
        error: 'Quota Exceeded',
        message: `Monthly DaaS query quota (${subscriber.monthlyQuota}) exceeded. Contact sales to upgrade your tier.`,
      });
      return;
    }

    // 4. Attach subscriber context and synthetic user identity
    req.subscriber = subscriber;
    req.user = {
      id: subscriber.id,
      name: subscriber.name,
      role: 'data_subscriber',
    };

    // 5. Expose standard rate limit and quota headers
    res.setHeader('X-RateLimit-Limit', subscriber.rateLimitPerMinute);
    res.setHeader('X-Quota-Monthly', subscriber.monthlyQuota);
    res.setHeader('X-Quota-Remaining', Math.max(0, subscriber.monthlyQuota - subscriber.currentMonthUsage));

    next();
  } catch (error) {
    next(error);
  }
};
