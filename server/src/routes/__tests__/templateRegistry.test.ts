import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import type { Response, NextFunction } from 'express';
import request from 'supertest';
import { createTemplateRegistryRoutes } from '../templateRegistry';
import { TemplateRegistryEntry } from '../../types/templateGraph';
import type { AuthenticatedRequest } from '../../middleware/auth';
import type { TemplateRegistryService } from '../../services/templateRegistryService';

vi.mock('../../middleware/auth', () => ({
  authMiddleware: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      req.user = { id: 'admin-user', role: 'admin' };
    }
    next();
  },
  optionalAuthMiddleware: (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      req.user = { id: 'admin-user', role: 'admin' };
    }
    next();
  },
  AuthenticatedRequest: {},
}));

function createMockService() {
  const templates: TemplateRegistryEntry[] = [
    {
      templateId: 'bbva-pyme-v1',
      insurer: 'BBVA',
      displayName: 'BBVA PYME',
      version: 1,
      fingerprints: { textMarkers: ['BBVA SEGUROS'], layoutMarkers: [], minConfidence: 90 },
      schema: { type: 'object' },
      extractionHints: { deductibleColumnIndex: 2 },
      promptAddon: '',
    },
  ];

  return {
    loadTemplates: vi.fn(async () => templates),
    getTemplate: vi.fn((id: string) => templates.find((t) => t.templateId === id)),
    upsertTemplate: vi.fn(async () => {}),
    deleteTemplate: vi.fn(async () => {}),
    invalidateCache: vi.fn(async () => {}),
    refreshCache: vi.fn(async () => {}),
    matchTemplate: vi.fn(async () => ({ templateId: null, templateConfidence: null, template: null })),
    validatePayload: vi.fn(() => ({ valid: true })),
  };
}

function buildApp(role: string = 'admin') {
  const service = createMockService();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as AuthenticatedRequest).user = { id: 'user', role };
    next();
  });
  app.use('/api/templates/registry', createTemplateRegistryRoutes(service as unknown as TemplateRegistryService));
  return { app, service };
}

describe('templateRegistry routes', () => {
  it('lists templates for the default domain', async () => {
    const { app } = buildApp();

    const response = await request(app).get('/api/templates/registry');

    expect(response.status).toBe(200);
    expect(response.body.domain).toBe('pyme');
    expect(response.body.templates).toHaveLength(1);
  });

  it('returns a single template by id', async () => {
    const { app } = buildApp();

    const response = await request(app).get('/api/templates/registry/bbva-pyme-v1');

    expect(response.status).toBe(200);
    expect(response.body.template.templateId).toBe('bbva-pyme-v1');
  });

  it('returns 404 for an unknown template id', async () => {
    const { app } = buildApp();

    const response = await request(app).get('/api/templates/registry/unknown');

    expect(response.status).toBe(404);
  });

  it('creates or updates a template', async () => {
    const { app, service } = buildApp();
    const entry: TemplateRegistryEntry = {
      templateId: 'test-template',
      insurer: 'TEST',
      displayName: 'Test',
      version: 1,
      fingerprints: { textMarkers: ['TEST'], layoutMarkers: [], minConfidence: 90 },
      schema: { type: 'object' },
      extractionHints: {},
      promptAddon: '',
    };

    const response = await request(app)
      .post('/api/templates/registry')
      .send(entry);

    expect(response.status).toBe(200);
    expect(service.upsertTemplate).toHaveBeenCalledWith(entry, 'pyme');
  });

  it('rejects an invalid template payload', async () => {
    const { app } = buildApp();

    const response = await request(app)
      .post('/api/templates/registry')
      .send({ insurer: 'TEST' });

    expect(response.status).toBe(400);
  });

  it('deletes a template', async () => {
    const { app, service } = buildApp();

    const response = await request(app).delete('/api/templates/registry/bbva-pyme-v1');

    expect(response.status).toBe(200);
    expect(service.deleteTemplate).toHaveBeenCalledWith('bbva-pyme-v1', 'pyme');
  });

  it('refreshes cache for a template', async () => {
    const { app, service } = buildApp();

    const response = await request(app).post('/api/templates/registry/bbva-pyme-v1/refresh-cache');

    expect(response.status).toBe(200);
    expect(service.invalidateCache).toHaveBeenCalledWith('bbva-pyme-v1', 'pyme');
    expect(service.loadTemplates).toHaveBeenCalled();
  });

  it('rejects non-admin roles', async () => {
    const { app } = buildApp('user');

    const response = await request(app).get('/api/templates/registry');

    expect(response.status).toBe(403);
  });
});
