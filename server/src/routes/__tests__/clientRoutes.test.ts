import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';
import clientRoutes from '../clientRoutes';
import type { AuthenticatedRequest } from '../../middleware/auth';

/**
 * AUTH-2: client routes derive ownership from the authenticated session.
 * Client-supplied userId (body or query) is rejected with 400 to prevent
 * spoofing; all queries are scoped with .eq('user_id', <session user>).
 */

interface MockChain {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const chain: MockChain = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  single: vi.fn(),
};

const fromMock = vi.fn();

vi.mock('../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

function wireChain(result: unknown): void {
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockResolvedValue(result);
  chain.limit.mockResolvedValue(result);
  chain.single.mockResolvedValue(result);
  fromMock.mockReturnValue(chain);
}

function getHandler(method: 'get' | 'post') {
  const layer = (
    clientRoutes as unknown as {
      stack: Array<{
        route?: { methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
      }>;
    }
  ).stack.find((l) => l.route?.methods?.[method]);
  const routeStack = layer?.route?.stack ?? [];
  return routeStack[routeStack.length - 1].handle as (
    req: AuthenticatedRequest,
    res: Response,
    next: (err?: unknown) => void
  ) => void;
}

const nextMock = vi.fn();

function createMockRes() {
  const jsonMock = vi.fn();
  const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock, json: jsonMock } as unknown as Response,
    jsonMock,
    statusMock,
  };
}

describe('clientRoutes (AUTH-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireChain({ data: [], error: null });
  });

  it('GET rejects a client-supplied userId query param with 400', async () => {
    const { res, statusMock, jsonMock } = createMockRes();
    const req = {
      user: { id: 'user-a' },
      query: { userId: 'user-b' },
    } as unknown as AuthenticatedRequest;

    // asyncHandler returns void and swallows rejections via .catch(next);
    // flush microtasks so the wrapped handler completes before asserting.
    getHandler('get')(req, res, nextMock);
    await new Promise((resolve) => setImmediate(resolve));
    expect(nextMock).not.toHaveBeenCalled();

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('GET scopes the query to the authenticated user id', async () => {
    const { res } = createMockRes();
    const req = { user: { id: 'user-a' }, query: {} } as unknown as AuthenticatedRequest;

    // asyncHandler returns void and swallows rejections via .catch(next);
    // flush microtasks so the wrapped handler completes before asserting.
    getHandler('get')(req, res, nextMock);
    await new Promise((resolve) => setImmediate(resolve));
    expect(nextMock).not.toHaveBeenCalled();

    expect(fromMock).toHaveBeenCalledWith('client_profiles');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-a');
  });

  it('GET returns an empty list for anonymous requests (allowlisted route)', async () => {
    const { res, jsonMock } = createMockRes();
    const req = { query: {} } as unknown as AuthenticatedRequest;

    // asyncHandler returns void and swallows rejections via .catch(next);
    // flush microtasks so the wrapped handler completes before asserting.
    getHandler('get')(req, res, nextMock);
    await new Promise((resolve) => setImmediate(resolve));
    expect(nextMock).not.toHaveBeenCalled();

    expect(jsonMock).toHaveBeenCalledWith([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('POST rejects a client-supplied userId in the body with 400', async () => {
    const { res, statusMock } = createMockRes();
    const req = {
      user: { id: 'user-a' },
      query: {},
      body: { name: 'Client', userId: 'user-b' },
    } as unknown as AuthenticatedRequest;

    getHandler('post')(req, res, nextMock);
    await new Promise((resolve) => setImmediate(resolve));
    expect(nextMock).not.toHaveBeenCalled();

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('POST persists the profile under the authenticated user id', async () => {
    wireChain({ data: null, error: null });
    chain.single.mockResolvedValue({
      data: { id: 'p1', raw_client_data: { name: 'Client' } },
      error: null,
    });
    const { res, statusMock } = createMockRes();
    const req = {
      user: { id: 'user-a' },
      query: {},
      body: { name: 'Client', industry: 'Logística' },
    } as unknown as AuthenticatedRequest;

    getHandler('post')(req, res, nextMock);
    await new Promise((resolve) => setImmediate(resolve));
    expect(nextMock).not.toHaveBeenCalled();

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-a', client_name: 'Client' })
    );
    expect(statusMock).toHaveBeenCalledWith(201);
  });
});
