import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-1 / task 1.6 — policyRepository.
 * Contract: R1.1 (CRUD scoped to session user), R1.3 (provenance recorded:
 * 'analysis' | 'incumbent_pdf' | 'manual', optional source_analysis_id link),
 * R1.4 (whitelist persistence — minimized ramo_details kept, extraneous
 * top-level fields stripped), AUTH-2 (ownership ONLY from the session-derived
 * userId parameter).
 */

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const chain: MockChain = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  single: vi.fn(),
};

const fromMock = vi.fn();

vi.mock('../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  createPolicy,
  listPolicies,
  getPolicyById,
  updatePolicy,
  deletePolicy,
} from '../policyRepository';

function wireChain(result: unknown): void {
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  fromMock.mockReturnValue(chain);
}

const SESSION_USER = 'user-session-123';

describe('policyRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPolicy', () => {
    it('persists user_id from the session parameter and records provenance (R1.3, AUTH-2)', async () => {
      wireChain({ data: { id: 'p1', user_id: SESSION_USER }, error: null });

      const result = await createPolicy(SESSION_USER, {
        client_id: 'c1',
        ramo: 'autos',
        insurer: 'Seguros Bolívar',
        provenance: 'analysis',
        source_analysis_id: 'a1',
        user_id: 'attacker',
        org_id: 'org-spoof',
      } as never);

      expect(fromMock).toHaveBeenCalledWith('policies');
      const inserted = chain.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(inserted.user_id).toBe(SESSION_USER);
      expect(inserted).not.toHaveProperty('org_id');
      expect(inserted.provenance).toBe('analysis');
      expect(inserted.source_analysis_id).toBe('a1');
      expect(result?.id).toBe('p1');
    });

    it('defaults provenance to manual when not provided', async () => {
      wireChain({ data: { id: 'p2' }, error: null });

      await createPolicy(SESSION_USER, {
        client_id: 'c1',
        ramo: 'pyme',
        insurer: 'SURA',
      });

      const inserted = chain.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(inserted.provenance).toBe('manual');
    });

    it('keeps minimized ramo_details but strips extraneous top-level fields (R1.4)', async () => {
      wireChain({ data: { id: 'p3' }, error: null });

      await createPolicy(SESSION_USER, {
        client_id: 'c1',
        ramo: 'autos',
        insurer: 'HDI',
        premium: 2500000,
        end_date: '2026-12-31',
        ramo_details: { plate: 'ABC123', model: 'Mazda 3', value: 90000000 },
        favorite_color: 'blue',
        broker_notes: 'should not persist',
      } as never);

      const inserted = chain.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(inserted.ramo_details).toEqual({ plate: 'ABC123', model: 'Mazda 3', value: 90000000 });
      expect(inserted).not.toHaveProperty('favorite_color');
      expect(inserted).not.toHaveProperty('broker_notes');
      expect(Object.keys(inserted).sort()).toEqual(
        [
          'client_id',
          'ramo',
          'insurer',
          'premium',
          'end_date',
          'ramo_details',
          'provenance',
          'user_id',
        ].sort()
      );
    });
  });

  describe('listPolicies', () => {
    it('scopes the query to the session user_id and orders by end_date', async () => {
      wireChain({ data: [{ id: 'p1' }, { id: 'p2' }], error: null });

      const result = await listPolicies(SESSION_USER);

      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(chain.order).toHaveBeenCalledWith('end_date', { ascending: true });
      expect(result).toHaveLength(2);
    });
  });

  describe('getPolicyById', () => {
    it('scopes by both id and session user_id', async () => {
      wireChain({ data: { id: 'p1', ramo: 'salud' }, error: null });

      const result = await getPolicyById(SESSION_USER, 'p1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(result?.ramo).toBe('salud');
    });

    it('returns null when the row does not exist (PGRST116)', async () => {
      wireChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

      const result = await getPolicyById(SESSION_USER, 'missing');

      expect(result).toBeNull();
    });
  });

  describe('updatePolicy', () => {
    it('scopes by id + session user_id and never updates ownership/immutable columns', async () => {
      wireChain({ data: { id: 'p1', premium: 3000000 }, error: null });

      const result = await updatePolicy(SESSION_USER, 'p1', {
        premium: 3000000,
        user_id: 'attacker',
        org_id: 'org-spoof',
        client_id: 'other-client',
      } as never);

      const updated = chain.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updated).not.toHaveProperty('user_id');
      expect(updated).not.toHaveProperty('org_id');
      expect(updated).not.toHaveProperty('client_id');
      expect(updated.premium).toBe(3000000);
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(result?.premium).toBe(3000000);
    });
  });

  describe('deletePolicy', () => {
    it('scopes the delete to the session user_id', async () => {
      chain.delete.mockReturnValue(chain);
      chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ data: null, error: null });
      fromMock.mockReturnValue(chain);

      await deletePolicy(SESSION_USER, 'p1');

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'p1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
    });
  });
});
