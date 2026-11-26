import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockListCases = vi.fn();
const mockGetCaseById = vi.fn();
const mockCreateCase = vi.fn();
const mockUpdateCase = vi.fn();
const mockDeleteCase = vi.fn();

vi.mock('../../middleware/auth', () => ({
  requireUser: (req: express.Request) =>
    (req as unknown as { user?: { id: string } }).user?.id || 'user-1',
}));

vi.mock('../../services/cumplimientoCaseService', () => ({
  listCumplimientoCases: (...args: unknown[]) => mockListCases(...args),
  getCumplimientoCaseById: (...args: unknown[]) => mockGetCaseById(...args),
  createCumplimientoCase: (...args: unknown[]) => mockCreateCase(...args),
  updateCumplimientoCase: (...args: unknown[]) => mockUpdateCase(...args),
  appendValidationToCase: vi.fn(),
  deleteCumplimientoCase: (...args: unknown[]) => mockDeleteCase(...args),
}));

import cumplimientoRoutes from '../cumplimientoRoutes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: { id: string; orgId: string; role: string } }).user = {
      id: 'user-1',
      orgId: 'org-1',
      role: 'ally_technical',
    };
    next();
  });
  app.use('/api/cumplimiento', cumplimientoRoutes);
  return app;
}

describe('cumplimientoRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/cumplimiento/cases lists cases scoped to session user/org', async () => {
    mockListCases.mockResolvedValue([{ id: 'case-1', title: 'Contrato 045' }]);
    const res = await request(buildApp()).get('/api/cumplimiento/cases');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockListCases).toHaveBeenCalledWith({
      userId: 'user-1',
      orgId: 'org-1',
      role: 'ally_technical',
    });
  });

  it('rejects client-supplied userId query/body with 400', async () => {
    const res = await request(buildApp()).get('/api/cumplimiento/cases?userId=spoofed-user');
    expect(res.status).toBe(400);
    expect(mockListCases).not.toHaveBeenCalled();
  });

  it('PATCH /api/cumplimiento/cases/:id updates case status and checklist', async () => {
    mockUpdateCase.mockResolvedValue({ id: 'case-1', status: 'READY_TO_QUOTE' });
    const res = await request(buildApp())
      .patch('/api/cumplimiento/cases/case-1')
      .send({ status: 'READY_TO_QUOTE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY_TO_QUOTE');
  });

  it('DELETE /api/cumplimiento/cases/:id returns 204', async () => {
    mockDeleteCase.mockResolvedValue(undefined);
    const res = await request(buildApp()).delete('/api/cumplimiento/cases/case-1');
    expect(res.status).toBe(204);
  });
});
