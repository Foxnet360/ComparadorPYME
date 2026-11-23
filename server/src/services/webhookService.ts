import crypto from 'crypto';
import { promises as dns } from 'dns';
import net from 'net';
import { supabase } from '../config/database';
import logger from '../config/logger';

export type WebhookLookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<Array<{ address: string; family: number }>>;

export type WebhookEventType =
  | 'analysis.completed'
  | 'analysis.status_changed'
  | 'renewal.status_changed';

export interface WebhookDispatchInput {
  url: string;
  secret: string;
  event: string;
  eventId: string;
  data: Record<string, unknown>;
}

export interface WebhookDispatchOptions {
  fetchFn?: typeof fetch;
  lookupFn?: WebhookLookupFn;
  maxAttempts?: number;
  baseDelayMs?: number;
}

export interface WebhookDispatchResult {
  delivered: boolean;
  attempts: number;
  statusCode?: number;
  error?: string;
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function expandIpv6Hextets(ip: string): number[] | null {
  let addr = ip.toLowerCase();
  const zoneIdx = addr.indexOf('%');
  if (zoneIdx !== -1) {
    addr = addr.slice(0, zoneIdx);
  }

  // Convert trailing dotted-quad IPv4 segment (e.g. ::ffff:127.0.0.1) to 2 hextets
  const lastColon = addr.lastIndexOf(':');
  const tail = lastColon >= 0 ? addr.slice(lastColon + 1) : '';
  if (tail.includes('.') && net.isIPv4(tail)) {
    const octets = tail.split('.').map((n) => Number(n));
    const h1 = ((octets[0]! << 8) | octets[1]!).toString(16);
    const h2 = ((octets[2]! << 8) | octets[3]!).toString(16);
    addr = `${addr.slice(0, lastColon)}:${h1}:${h2}`;
  }

  const parts = addr.split('::');
  if (parts.length > 2) return null;

  const head = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const tailParts = parts[1] ? parts[1].split(':').filter(Boolean) : [];

  const totalExplicit = head.length + tailParts.length;
  if (parts.length === 1 && totalExplicit !== 8) return null;
  if (parts.length === 2 && totalExplicit >= 8) return null;

  const zeroFillCount = parts.length === 2 ? 8 - totalExplicit : 0;
  const full = [...head, ...Array(zeroFillCount).fill('0'), ...tailParts];
  if (full.length !== 8) return null;

  const hextets = full.map((h) => parseInt(h, 16));
  if (hextets.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return hextets;
}

function isPrivateIpv6(ip: string): boolean {
  const hextets = expandIpv6Hextets(ip);
  if (!hextets) return true; // Fail closed on unparseable IPv6

  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const allZeroPrefix = h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0;

  // :: (unspecified) and ::1 (loopback)
  if (allZeroPrefix && h5 === 0 && h6 === 0 && (h7 === 0 || h7 === 1)) return true;
  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96)
  if (allZeroPrefix && (h5 === 0xffff || h5 === 0)) {
    const v4 = `${h6 >> 8}.${h6 & 0xff}.${h7 >> 8}.${h7 & 0xff}`;
    return isPrivateIpv4(v4);
  }
  // ULA fc00::/7
  if ((h0 & 0xfe00) === 0xfc00) return true;
  // Link-local fe80::/10 (fe80 - febf)
  if ((h0 & 0xffc0) === 0xfe80) return true;

  return false;
}

function assertSafeIpAddress(ip: string): void {
  const version = net.isIP(ip);
  if (version === 4 && isPrivateIpv4(ip)) {
    throw new Error('Private or loopback IPv4 webhook targets are forbidden');
  }
  if (version === 6 && isPrivateIpv6(ip)) {
    throw new Error('Private or loopback IPv6 webhook targets are forbidden');
  }
}

async function resolveAndValidateHost(hostname: string, lookupFn: WebhookLookupFn): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    assertSafeIpAddress(host);
    return;
  }
  const records = await lookupFn(host, { all: true });
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Webhook hostname resolved to no addresses');
  }
  for (const record of records) {
    if (!record?.address || !net.isIP(record.address)) {
      throw new Error('Webhook hostname resolved to invalid address');
    }
    assertSafeIpAddress(record.address);
  }
}

/**
 * Validates outbound webhook URLs against SSRF targets (loopback, metadata, private CIDR ranges).
 */
export function validateWebhookUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid webhook URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Webhook URL must use https or http protocol');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Webhook URL must not embed credentials');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error('Webhook host is not allowed (SSRF guard)');
  }

  assertSafeIpAddress(host);

  return parsed;
}

/**
 * Generates an HMAC-SHA256 signature header value (`sha256=<hex>`).
 */
export function signWebhookPayload(rawBody: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Dispatches a signed outbound webhook with exponential backoff on transient failures.
 */
export async function dispatchWebhookWithRetry(
  input: WebhookDispatchInput,
  options?: WebhookDispatchOptions
): Promise<WebhookDispatchResult> {
  const parsed = validateWebhookUrl(input.url);
  const lookupFn: WebhookLookupFn =
    options?.lookupFn ?? ((hostname, opts) => dns.lookup(hostname, opts));

  const fetchFn = options?.fetchFn ?? fetch;
  const maxAttempts = Math.max(1, options?.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 250);

  const rawBody = JSON.stringify({
    event: input.event,
    eventId: input.eventId,
    timestamp: new Date().toISOString(),
    data: input.data,
  });
  const signature = signWebhookPayload(rawBody, input.secret);

  let lastStatus: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await resolveAndValidateHost(parsed.hostname, lookupFn);

      const response = await fetchFn(input.url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          'X-CSA-Event': input.event,
          'X-CSA-Delivery': input.eventId,
          'X-CSA-Signature-256': signature,
        },
        body: rawBody,
        signal: AbortSignal.timeout(8000),
      });

      lastStatus = response.status;
      if (response.ok) {
        return { delivered: true, attempts: attempt, statusCode: response.status };
      }

      lastError = `HTTP ${response.status}`;
      // Do not retry non-429 4xx client errors
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return {
          delivered: false,
          attempts: attempt,
          statusCode: response.status,
          error: lastError,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < maxAttempts && baseDelayMs > 0) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  return {
    delivered: false,
    attempts: maxAttempts,
    statusCode: lastStatus,
    error: lastError || 'Delivery failed',
  };
}

export interface WebhookSubscriptionRecord {
  id: string;
  user_id: string;
  org_id: string | null;
  url: string;
  events: string[];
  is_active: boolean;
  signing_secret?: string;
  created_at: string;
}

export interface PublicWebhookSubscription {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

function toPublicSubscription(row: WebhookSubscriptionRecord): PublicWebhookSubscription {
  return {
    id: row.id,
    url: row.url,
    events: Array.isArray(row.events) ? row.events : [],
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

export const webhookService = {
  listSubscriptions: async (
    userId: string,
    orgId?: string | null
  ): Promise<PublicWebhookSubscription[]> => {
    let query = supabase
      .from('webhook_subscriptions' as never)
      .select('id, user_id, org_id, url, events, is_active, created_at')
      .order('created_at', { ascending: false });

    query = orgId
      ? query.or(`user_id.eq.${userId},org_id.eq.${orgId}`)
      : query.eq('user_id', userId);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return [];
    }
    return (data as WebhookSubscriptionRecord[]).map(toPublicSubscription);
  },

  createSubscription: async (input: {
    userId: string;
    orgId?: string | null;
    url: string;
    events: string[];
  }): Promise<PublicWebhookSubscription & { secret: string }> => {
    validateWebhookUrl(input.url);
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const { data, error } = await supabase
      .from('webhook_subscriptions' as never)
      .insert({
        user_id: input.userId,
        org_id: input.orgId || null,
        url: input.url,
        events: input.events,
        signing_secret: secret,
        is_active: true,
      } as never)
      .select('id, user_id, org_id, url, events, is_active, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create webhook subscription');
    }

    return {
      ...toPublicSubscription(data as unknown as WebhookSubscriptionRecord),
      secret,
    };
  },

  deleteSubscription: async (subscriptionId: string, userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('webhook_subscriptions' as never)
      .delete()
      .eq('id', subscriptionId)
      .eq('user_id', userId)
      .select('id');

    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  },

  emitEvent: async (input: {
    userId: string;
    orgId?: string | null;
    event: WebhookEventType;
    eventId?: string;
    data: Record<string, unknown>;
  }): Promise<void> => {
    const eventId = input.eventId || crypto.randomUUID();
    try {
      let query = supabase
        .from('webhook_subscriptions' as never)
        .select('id, user_id, org_id, url, events, is_active, signing_secret')
        .eq('is_active', true);

      query = input.orgId
        ? query.or(`user_id.eq.${input.userId},org_id.eq.${input.orgId}`)
        : query.eq('user_id', input.userId);

      const { data: subs, error } = await query;
      if (error || !Array.isArray(subs) || subs.length === 0) {
        return;
      }

      const matching = (subs as WebhookSubscriptionRecord[]).filter(
        (sub) =>
          Boolean(sub.signing_secret) &&
          (sub.events.includes(input.event) || sub.events.includes('*'))
      );

      for (const sub of matching) {
        const { error: claimError } = await supabase.from('webhook_deliveries' as never).insert({
          subscription_id: sub.id,
          event_id: eventId,
          event_type: input.event,
          status: 'pending',
        } as never);

        // Unique violation => already claimed/dispatched idempotently
        if (claimError) {
          continue;
        }

        const result = await dispatchWebhookWithRetry({
          url: sub.url,
          secret: sub.signing_secret!,
          event: input.event,
          eventId,
          data: input.data,
        });

        await supabase
          .from('webhook_deliveries' as never)
          .update({
            status: result.delivered ? 'delivered' : 'failed',
            attempts: result.attempts,
            http_status: result.statusCode ?? null,
            last_error: result.error ?? null,
            delivered_at: result.delivered ? new Date().toISOString() : null,
          } as never)
          .eq('subscription_id', sub.id)
          .eq('event_id', eventId);
      }
    } catch (err) {
      logger.warn({ err, event: input.event }, '⚠️ Outbound webhook emit failed silently');
    }
  },
};
