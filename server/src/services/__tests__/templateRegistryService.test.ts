import { describe, it, expect, vi } from 'vitest';
import {
  createTemplateRegistryService,
  TemplateMatchResult,
  RegistryCache,
} from '../templateRegistryService';
import { TemplateRegistryEntry } from '../../types/templateGraph';

const bbvaText = `BBVA SEGUROS
COT-2026-001
COBERTURAS / DEDUCIBLE
Todo Riesgo Daño Material`;

const sbsText = `SEGUROS SBS
Resumen de coberturas y primas
Todo riesgo daños materiales`;

const mapfreText = `MAPFRE
COTIZACION TODO RIESGO PYME
SECCION PRIMERA - AMPARO BASICO
SECCION SEGUNDA - TERREMOTO`;

const unknownText = `Aseguradora Desconocida SA
Cobertura generica sin marcadores`;

function makeCache(): RegistryCache {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ttl: number) => {
      store.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    keys: vi.fn(async (pattern: string) =>
      Array.from(store.keys()).filter((k) => new RegExp(pattern.replace('*', '.*')).test(k))
    ),
  };
}

function makeFakeDb() {
  const rows: Record<string, unknown>[] = [];
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: rows, error: null })),
          order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
      })),
      insert: vi.fn((data: unknown) => {
        rows.push(...(Array.isArray(data) ? data : [data]));
        return Promise.resolve({ data, error: null });
      }),
      update: vi.fn((data: unknown) => ({
        eq: vi.fn(() => Promise.resolve({ data: [data], error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn((data: unknown) => Promise.resolve({ data, error: null })),
    })),
  };
}

describe('templateRegistryService', () => {
  describe('matchTemplate', () => {
    it('detects the BBVA template from text markers', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const result = await service.matchTemplate({ text: bbvaText, domain: 'pyme' });

      expect(result.templateId).toBe('bbva-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
      expect(result.template?.insurer).toBe('BBVA');
    });

    it('detects the SBS template from text markers', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const result = await service.matchTemplate({ text: sbsText, domain: 'pyme' });

      expect(result.templateId).toBe('sbs-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
      expect(result.template?.insurer).toBe('SBS');
    });

    it('detects the MAPFRE template from text markers', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const result = await service.matchTemplate({ text: mapfreText, domain: 'pyme' });

      expect(result.templateId).toBe('mapfre-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
      expect(result.template?.insurer).toBe('MAPFRE');
    });

    it('returns null when no template matches', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const result = await service.matchTemplate({ text: unknownText, domain: 'pyme' });

      expect(result.templateId).toBeNull();
      expect(result.templateConfidence).toBeNull();
      expect(result.template).toBeNull();
    });

    it('uses layout markers to boost confidence', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const pages = [
        {
          page: 1,
          items: [
            { text: 'BBVA', x: 500, y: 50, width: 60, height: 12 },
            { text: 'COBERTURAS / DEDUCIBLE', x: 120, y: 150, width: 150, height: 12 },
          ],
        },
      ];

      const result = await service.matchTemplate({ text: bbvaText, pages, domain: 'pyme' });

      expect(result.templateId).toBe('bbva-pyme-v1');
      expect(result.templateConfidence).toBeGreaterThanOrEqual(90);
    });
  });

  describe('getTemplate', () => {
    it('returns a seeded template by id', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const template = service.getTemplate('bbva-pyme-v1', 'pyme');

      expect(template).toBeDefined();
      expect(template?.templateId).toBe('bbva-pyme-v1');
      expect(template?.extractionHints.deductibleColumnIndex).toBe(2);
    });

    it('returns undefined for an unknown template id', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const template = service.getTemplate('no-such-template', 'pyme');

      expect(template).toBeUndefined();
    });
  });

  describe('validatePayload', () => {
    it('accepts a payload that conforms to the template schema', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const payload = {
        coverages: [
          {
            rawName: 'Todo Riesgo Daño Material',
            insuredAmount: '$100.000.000',
            deductible: '10%',
            premium: '$1.200.000',
            subLimits: [],
          },
        ],
      };

      const result = service.validatePayload('bbva-pyme-v1', payload, 'pyme');

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('rejects a payload that violates required fields', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const payload = {
        coverages: [
          {
            rawName: 'Todo Riesgo Daño Material',
            insuredAmount: '$100.000.000',
          },
        ],
      };

      const result = service.validatePayload('bbva-pyme-v1', payload, 'pyme');

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('rejects a payload with the wrong top-level type', async () => {
      const service = createTemplateRegistryService();
      await service.loadTemplates('pyme');

      const result = service.validatePayload('bbva-pyme-v1', ['not an object'], 'pyme');

      expect(result.valid).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('cache', () => {
    it('caches loaded templates', async () => {
      const cache = makeCache();
      const service = createTemplateRegistryService({ cache });

      await service.loadTemplates('pyme');

      expect(cache.set).toHaveBeenCalled();
      const calls = (cache.set as ReturnType<typeof vi.fn>).mock.calls;
      const keys = calls.map((call: unknown[]) => call[0] as string);
      expect(keys.some((k) => k.includes('templates'))).toBe(true);
    });

    it('uses the cache on subsequent loads', async () => {
      const cache = makeCache();
      const seeded: TemplateRegistryEntry[] = [
        {
          templateId: 'cached-template',
          insurer: 'TEST',
          displayName: 'Cached',
          version: 1,
          fingerprints: { textMarkers: ['CACHED'], layoutMarkers: [], minConfidence: 90 },
          schema: { type: 'object' },
          extractionHints: {},
          promptAddon: '',
        },
      ];
      await cache.set('templates:pyme', JSON.stringify(seeded), 60);

      const service = createTemplateRegistryService({ cache });
      await service.loadTemplates('pyme');

      expect(cache.get).toHaveBeenCalledWith(expect.stringContaining('templates:pyme'));
      expect(service.getTemplate('cached-template', 'pyme')).toBeDefined();
    });

    it('refreshes the cache when asked', async () => {
      const cache = makeCache();
      const service = createTemplateRegistryService({ cache });
      await service.loadTemplates('pyme');

      await service.refreshCache('pyme');

      expect(cache.del).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();
    });

    it('invalidates cache keys for a template', async () => {
      const cache = makeCache();
      const service = createTemplateRegistryService({ cache });
      await service.loadTemplates('pyme');

      await service.invalidateCache('bbva-pyme-v1', 'pyme');

      const delCalls = (cache.del as ReturnType<typeof vi.fn>).mock.calls;
      expect(delCalls.length).toBeGreaterThan(0);
    });
  });

  describe('CRUD', () => {
    it('upserts a template into the database', async () => {
      const db = makeFakeDb();
      const service = createTemplateRegistryService({ db });

      const entry: TemplateRegistryEntry = {
        templateId: 'test-template',
        insurer: 'TEST',
        displayName: 'Test Template',
        version: 1,
        fingerprints: { textMarkers: ['TEST'], layoutMarkers: [], minConfidence: 90 },
        schema: { type: 'object' },
        extractionHints: {},
        promptAddon: 'test',
      };

      await service.upsertTemplate(entry, 'pyme');

      expect(db.from).toHaveBeenCalledWith('template_registry');
    });

    it('deletes a template from the database', async () => {
      const db = makeFakeDb();
      const service = createTemplateRegistryService({ db });

      await service.deleteTemplate('test-template', 'pyme');

      expect(db.from).toHaveBeenCalledWith('template_registry');
    });
  });
});
