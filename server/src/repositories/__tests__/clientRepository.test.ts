import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * renovacion-polizas PR-1 / task 1.6 — clientRepository.
 * Contract: R1.1 (CRUD scoped to session user), AUTH-2 (ownership ONLY from
 * the session-derived userId parameter; client-supplied user_id/userId/org_id
 * in payloads is never honored), R1.4 (whitelist persistence — extraneous
 * fields are stripped).
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
  createClient,
  listClients,
  getClientById,
  updateClient,
  deleteClient,
} from '../clientRepository';

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

describe('clientRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createClient', () => {
    it('persists user_id from the session parameter, never from the payload (AUTH-2)', async () => {
      wireChain({ data: { id: 'c1', user_id: SESSION_USER, name: 'Acme' }, error: null });

      const result = await createClient(SESSION_USER, {
        name: 'Acme',
        // Spoofing attempts below MUST be ignored:
        user_id: 'attacker',
        userId: 'attacker',
        org_id: 'org-spoof',
        id: 'forced-id',
      } as never);

      expect(fromMock).toHaveBeenCalledWith('clients');
      const inserted = chain.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(inserted.user_id).toBe(SESSION_USER);
      expect(inserted).not.toHaveProperty('userId');
      expect(inserted).not.toHaveProperty('org_id');
      expect(inserted).not.toHaveProperty('id');
      expect(inserted.name).toBe('Acme');
      expect(result?.id).toBe('c1');
    });

    it('stores only the minimal field set (R1.4): extraneous fields stripped', async () => {
      wireChain({ data: { id: 'c2' }, error: null });

      await createClient(SESSION_USER, {
        name: 'Beta SAS',
        tax_id: '900123',
        contact: { email: 'a@b.co' },
        favorite_color: 'blue',
        internal_notes: 'should not persist',
      } as never);

      const inserted = chain.insert.mock.calls[0][0] as Record<string, unknown>;
      expect(Object.keys(inserted).sort()).toEqual(['contact', 'name', 'tax_id', 'user_id']);
    });
  });

  describe('listClients', () => {
    it('scopes the query to the session user_id', async () => {
      wireChain({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });

      const result = await listClients(SESSION_USER);

      expect(fromMock).toHaveBeenCalledWith('clients');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when the user owns no clients (setup: no rows)', async () => {
      wireChain({ data: [], error: null });

      const result = await listClients('user-with-nothing');

      expect(result).toEqual([]);
    });
  });

  describe('getClientById', () => {
    it('scopes by both id and session user_id', async () => {
      wireChain({ data: { id: 'c1', name: 'Acme' }, error: null });

      const result = await getClientById(SESSION_USER, 'c1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(result?.name).toBe('Acme');
    });

    it('returns null when the row does not exist (PGRST116)', async () => {
      wireChain({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

      const result = await getClientById(SESSION_USER, 'missing');

      expect(result).toBeNull();
    });
  });

  describe('updateClient', () => {
    it('scopes by id + session user_id and never updates ownership columns', async () => {
      wireChain({ data: { id: 'c1', name: 'Renamed' }, error: null });

      const result = await updateClient(SESSION_USER, 'c1', {
        name: 'Renamed',
        user_id: 'attacker',
        org_id: 'org-spoof',
      } as never);

      const updated = chain.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updated).not.toHaveProperty('user_id');
      expect(updated).not.toHaveProperty('org_id');
      expect(updated.name).toBe('Renamed');
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
      expect(result?.name).toBe('Renamed');
    });
  });

  describe('deleteClient', () => {
    it('scopes the delete to the session user_id', async () => {
      chain.delete.mockReturnValue(chain);
      chain.eq.mockReturnValueOnce(chain).mockResolvedValueOnce({ data: null, error: null });
      fromMock.mockReturnValue(chain);

      await deleteClient(SESSION_USER, 'c1');

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('user_id', SESSION_USER);
    });
  });
});
