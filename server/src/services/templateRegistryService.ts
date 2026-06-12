import Ajv from 'ajv';
import { loadDomainJson } from './domainBundleLoader';
import {
  assertTemplateRegistryEntry,
  TemplateRegistryEntry,
} from '../schemas/templateRegistrySchema';
import {
  getCacheValue,
  setCacheValue,
  deleteCacheValue,
  getCacheKeys,
} from './cache/redisCache';
import {
  createStructuredLogger,
  globalMetrics,
  StructuredLogger,
  MetricCollector,
} from '../utils/structuredLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface PageTextItems {
  page: number;
  items: TextItem[];
}

export interface TemplateMatchInput {
  text: string;
  pages?: PageTextItems[];
  domain?: string;
}

export interface TemplateMatchResult {
  templateId: string | null;
  templateConfidence: number | null;
  template: TemplateRegistryEntry | null;
}

export interface RegistryCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

export interface TemplateRegistryServiceDependencies {
  db?: any;
  cache?: RegistryCache;
  loadSeeds?: (domain: string) => TemplateRegistryEntry[];
  cacheTTLSeconds?: number;
  logger?: StructuredLogger;
  metrics?: MetricCollector;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DOMAIN = 'pyme';
const TEXT_MARKER_WEIGHT = 90;
const LAYOUT_MARKER_WEIGHT = 10;
const DEFAULT_CACHE_TTL = 60 * 60; // 1 hour

export const registryCacheKeys = {
  templates: (domain: string) => `templates:${domain}`,
  template: (domain: string, templateId: string) => `template:${domain}:${templateId}`,
  pattern: (domain: string, templateId: string) => `template:${domain}:${templateId}:*`,
};

// ---------------------------------------------------------------------------
// Default cache adapter (uses existing Redis/ioredis with memory fallback)
// ---------------------------------------------------------------------------

const defaultCache: RegistryCache = {
  get: getCacheValue,
  set: (key, value, ttl) => setCacheValue(key, ttl, value),
  del: deleteCacheValue,
  keys: getCacheKeys,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultLoadSeeds(domain: string): TemplateRegistryEntry[] {
  return loadDomainJson<TemplateRegistryEntry[]>(domain, 'template-seeds.json');
}

function normalizeText(text: string): string {
  return text.toUpperCase();
}

function regionPredicate(region: string, item: TextItem): boolean {
  const parts = region.toLowerCase().split('-');
  for (const part of parts) {
    switch (part) {
      case 'top':
        if (item.y > 200) return false;
        break;
      case 'bottom':
        if (item.y < 600) return false;
        break;
      case 'left':
        if (item.x > 250) return false;
        break;
      case 'right':
        if (item.x < 450) return false;
        break;
      case 'center':
        if (item.x <= 250 || item.x >= 450) return false;
        break;
      default:
        // Unknown region part is ignored
        break;
    }
  }
  return true;
}

function layoutMarkerMatches(
  marker: TemplateRegistryEntry['fingerprints']['layoutMarkers'][number],
  pages: PageTextItems[] | undefined
): boolean {
  if (!pages || pages.length === 0) {
    return false;
  }

  const regex = new RegExp(marker.textRegex, 'i');
  const candidatePages = marker.page
    ? pages.filter((p) => p.page === marker.page)
    : pages;

  for (const page of candidatePages) {
    for (const item of page.items) {
      if (regex.test(item.text) && regionPredicate(marker.region, item)) {
        return true;
      }
    }
  }

  return false;
}

function scoreEntry(
  entry: TemplateRegistryEntry,
  text: string,
  pages: PageTextItems[] | undefined
): number {
  const normalizedText = normalizeText(text);
  const markers = entry.fingerprints.textMarkers;

  const matchedTextMarkers = markers.filter((marker) =>
    normalizedText.includes(normalizeText(marker))
  ).length;
  const textScore =
    markers.length > 0 ? (matchedTextMarkers / markers.length) * TEXT_MARKER_WEIGHT : 0;

  const layoutMarkers = entry.fingerprints.layoutMarkers;
  const matchedLayoutMarkers = layoutMarkers.filter((marker) =>
    layoutMarkerMatches(marker, pages)
  ).length;
  const layoutScore =
    layoutMarkers.length > 0
      ? (matchedLayoutMarkers / layoutMarkers.length) * LAYOUT_MARKER_WEIGHT
      : 0;

  return Math.round(textScore + layoutScore);
}

function rowToEntry(row: any): TemplateRegistryEntry {
  return assertTemplateRegistryEntry({
    templateId: row.template_id,
    insurer: row.insurer,
    displayName: row.display_name,
    version: row.version,
    fingerprints: row.fingerprints,
    schema: row.schema,
    extractionHints: row.hints,
    promptAddon: row.prompt_addon,
  });
}

function entryToRow(entry: TemplateRegistryEntry, domain: string): any {
  return {
    template_id: entry.templateId,
    insurer: entry.insurer,
    display_name: entry.displayName,
    version: entry.version,
    fingerprints: entry.fingerprints,
    schema: entry.schema,
    hints: entry.extractionHints,
    prompt_addon: entry.promptAddon,
    domain,
    is_active: true,
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface TemplateRegistryService {
  loadTemplates(domain?: string): Promise<TemplateRegistryEntry[]>;
  matchTemplate(input: TemplateMatchInput): Promise<TemplateMatchResult>;
  getTemplate(templateId: string, domain?: string): TemplateRegistryEntry | undefined;
  validatePayload(
    templateId: string,
    payload: unknown,
    domain?: string
  ): { valid: boolean; errors?: string[] };
  refreshCache(domain?: string): Promise<void>;
  invalidateCache(templateId: string, domain?: string): Promise<void>;
  upsertTemplate(entry: TemplateRegistryEntry, domain?: string): Promise<void>;
  deleteTemplate(templateId: string, domain?: string): Promise<void>;
}

export function createTemplateRegistryService(
  deps: TemplateRegistryServiceDependencies = {}
): TemplateRegistryService {
  const db = deps.db;
  const cache = deps.cache ?? defaultCache;
  const loadSeeds = deps.loadSeeds ?? defaultLoadSeeds;
  const cacheTTL = deps.cacheTTLSeconds ?? DEFAULT_CACHE_TTL;
  const logger = deps.logger ?? createStructuredLogger('templateRegistryService');
  const metrics = deps.metrics ?? globalMetrics;

  const templateCache = new Map<string, TemplateRegistryEntry[]>();

  async function loadFromDatabase(domain: string): Promise<TemplateRegistryEntry[]> {
    if (!db) return [];

    try {
      const { data, error } = await db
        .from('template_registry')
        .select('*')
        .eq('domain', domain)
        .eq('is_active', true)
        .order('version', { ascending: false });

      if (error) {
        console.warn(`⚠️ [TemplateRegistry] DB load failed: ${error.message}`);
        return [];
      }

      const entries: TemplateRegistryEntry[] = [];
      for (const row of data ?? []) {
        try {
          entries.push(rowToEntry(row));
        } catch (parseError) {
          console.warn(
            `⚠️ [TemplateRegistry] Skipping invalid DB row ${row.template_id}: ${parseError}`
          );
        }
      }
      return entries;
    } catch (error) {
      console.warn(`⚠️ [TemplateRegistry] DB load error: ${error}`);
      return [];
    }
  }

  async function loadTemplates(domain: string = DEFAULT_DOMAIN): Promise<TemplateRegistryEntry[]> {
    const cacheKey = registryCacheKeys.templates(domain);
    const cached = await cache.get(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TemplateRegistryEntry[];
        templateCache.set(domain, parsed);
        return parsed;
      } catch {
        console.warn('⚠️ [TemplateRegistry] Failed to parse cached templates, reloading');
      }
    }

    const dbEntries = await loadFromDatabase(domain);
    const seeds = loadSeeds(domain);

    // DB entries take precedence over seeds for the same templateId.
    const byId = new Map<string, TemplateRegistryEntry>();
    for (const seed of seeds) {
      byId.set(seed.templateId, seed);
    }
    for (const entry of dbEntries) {
      byId.set(entry.templateId, entry);
    }

    const entries = Array.from(byId.values());
    templateCache.set(domain, entries);

    try {
      await cache.set(cacheKey, JSON.stringify(entries), cacheTTL);
    } catch (error) {
      console.warn(`⚠️ [TemplateRegistry] Cache write failed: ${error}`);
    }

    return entries;
  }

  function getLoadedTemplates(domain: string): TemplateRegistryEntry[] {
    return templateCache.get(domain) ?? [];
  }

  async function matchTemplate(
    input: TemplateMatchInput
  ): Promise<TemplateMatchResult> {
    const domain = input.domain ?? DEFAULT_DOMAIN;
    const entries = await loadTemplates(domain);

    let best: TemplateRegistryEntry | null = null;
    let bestScore = 0;

    for (const entry of entries) {
      const score = scoreEntry(entry, input.text, input.pages);
      const minConfidence = entry.fingerprints.minConfidence ?? 90;
      if (score >= minConfidence && score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    if (!best) {
      logger.info('template_miss', 'No template matched the input', {
        domain,
        inputLength: input.text.length,
        hasPages: (input.pages?.length ?? 0) > 0,
      });
      metrics.increment('templateRegistry.miss', { domain });
      return { templateId: null, templateConfidence: null, template: null };
    }

    logger.info('template_match', 'Template matched', {
      domain,
      templateId: best.templateId,
      insurer: best.insurer,
      confidence: bestScore,
    });
    metrics.increment('templateRegistry.match', {
      domain,
      templateId: best.templateId,
    });

    return {
      templateId: best.templateId,
      templateConfidence: bestScore,
      template: best,
    };
  }

  function getTemplate(
    templateId: string,
    domain: string = DEFAULT_DOMAIN
  ): TemplateRegistryEntry | undefined {
    return getLoadedTemplates(domain).find((t) => t.templateId === templateId);
  }

  function validatePayload(
    templateId: string,
    payload: unknown,
    domain: string = DEFAULT_DOMAIN
  ): { valid: boolean; errors?: string[] } {
    const template = getTemplate(templateId, domain);
    if (!template) {
      return { valid: false, errors: [`Template ${templateId} not found`] };
    }

    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(template.schema);
    const valid = validate(payload);

    if (valid) {
      return { valid: true };
    }

    const errors =
      validate.errors?.map((err) =>
        `${err.instancePath || '/'}: ${err.message ?? 'invalid value'}`
      ) ?? ['Schema validation failed'];

    logger.warn('schema_validation_failed', 'Template payload validation failed', {
      domain,
      templateId,
      errors,
    });
    metrics.increment('templateRegistry.schema_validation_failed', { domain, templateId });

    return { valid: false, errors };
  }

  async function refreshCache(domain: string = DEFAULT_DOMAIN): Promise<void> {
    logger.info('cache_refresh', 'Refreshing template registry cache', { domain });
    await invalidateCache('*', domain);
    await loadTemplates(domain);
  }

  async function invalidateCache(
    templateId: string,
    domain: string = DEFAULT_DOMAIN
  ): Promise<void> {
    try {
      await cache.del(registryCacheKeys.templates(domain));
      if (templateId !== '*') {
        await cache.del(registryCacheKeys.template(domain, templateId));
      } else {
        const keys = await cache.keys(registryCacheKeys.pattern(domain, '*'));
        for (const key of keys) {
          await cache.del(key);
        }
      }
    } catch (error) {
      console.warn(`⚠️ [TemplateRegistry] Cache invalidation failed: ${error}`);
    }
  }

  async function upsertTemplate(
    entry: TemplateRegistryEntry,
    domain: string = DEFAULT_DOMAIN
  ): Promise<void> {
    if (!db) {
      throw new Error('Template registry database not configured');
    }

    const row = entryToRow(entry, domain);
    const { error } = await db
      .from('template_registry')
      .upsert(row, { onConflict: 'template_id' });

    if (error) {
      throw new Error(`Failed to upsert template: ${error.message}`);
    }

    await invalidateCache(entry.templateId, domain);
  }

  async function deleteTemplate(
    templateId: string,
    domain: string = DEFAULT_DOMAIN
  ): Promise<void> {
    if (!db) {
      throw new Error('Template registry database not configured');
    }

    const { error } = await db
      .from('template_registry')
      .delete()
      .eq('template_id', templateId)
      .eq('domain', domain);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }

    await invalidateCache(templateId, domain);
  }

  return {
    loadTemplates,
    matchTemplate,
    getTemplate,
    validatePayload,
    refreshCache,
    invalidateCache,
    upsertTemplate,
    deleteTemplate,
  };
}

// ---------------------------------------------------------------------------
// Default service instance (uses Supabase + Redis cache)
// ---------------------------------------------------------------------------

export const templateRegistryService = createTemplateRegistryService();

export default templateRegistryService;
