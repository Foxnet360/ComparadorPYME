import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import type { Response, NextFunction } from 'express';
import request from 'supertest';
import { createTemplateRegistryRoutes } from '../templateRegistry';
import { coverageGraphService } from '../../services/coverageGraphService';
import { seedGraphFromThesaurus } from '../../services/thesaurusMapper';
import type { AuthenticatedRequest } from '../../middleware/auth';
import type { TemplateRegistryService } from '../../services/templateRegistryService';
import type { GraphEdge } from '../../schemas/templateRegistrySchema';

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

vi.mock('../../services/coverageGraphService', () => ({
  coverageGraphService: {
    listEdges: vi.fn(async () => []),
    addEdge: vi.fn(async () => {}),
    deleteEdge: vi.fn(async () => {}),
    learnCorrection: vi.fn(async () => {}),
  },
}));

vi.mock('../../services/thesaurusMapper', () => ({
  seedGraphFromThesaurus: vi.fn(async () => {}),
}));

function createMockService() {
  return {
    loadTemplates: vi.fn(async () => []),
    getTemplate: vi.fn(() => undefined),
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

describe('templateRegistry graph admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists graph edges with filters', async () => {
    vi.mocked(coverageGraphService.listEdges).mockResolvedValue([
      { from: 'Fuego', to: 'Incendio', type: 'alias_of', weight: 0.85, domain: 'pyme' },
    ] as unknown as GraphEdge[]);

    const { app } = buildApp();
    const response = await request(app)
      .get('/api/templates/registry/admin/graph/edges')
      .query({ type: 'alias_of', domain: 'pyme' });

    expect(response.status).toBe(200);
    expect(response.body.edges).toHaveLength(1);
    expect(coverageGraphService.listEdges).toHaveBeenCalledWith({
      type: 'alias_of',
      domain: 'pyme',
      insurer: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it('adds a graph edge', async () => {
    const { app } = buildApp();
    const edge = {
      from: 'Daño Material',
      to: 'Incendio (Edificio y Contenidos)',
      type: 'maps_to',
      weight: 0.9,
      domain: 'pyme',
      insurer: 'sbs',
    };

    const response = await request(app)
      .post('/api/templates/registry/admin/graph/edges')
      .send(edge);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(coverageGraphService.addEdge).toHaveBeenCalledWith(edge);
  });

  it('deletes a graph edge', async () => {
    const { app } = buildApp();

    const response = await request(app)
      .delete('/api/templates/registry/admin/graph/edges')
      .query({ from: 'Fuego', to: 'Incendio', type: 'alias_of', domain: 'pyme', insurer: 'sbs' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(coverageGraphService.deleteEdge).toHaveBeenCalledWith(
      'Fuego',
      'Incendio',
      'alias_of',
      'sbs',
      'pyme'
    );
  });

  it('records an analyst correction', async () => {
    const { app } = buildApp();

    const response = await request(app)
      .post('/api/templates/registry/admin/graph/corrections')
      .send({ raw: 'Daño Material Global', canonical: 'Incendio (Edificio y Contenidos)', domain: 'pyme', insurer: 'mapfre' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(coverageGraphService.learnCorrection).toHaveBeenCalledWith(
      'Daño Material Global',
      'Incendio (Edificio y Contenidos)',
      'mapfre',
      'pyme'
    );
  });

  it('seeds graph from thesaurus', async () => {
    const { app } = buildApp();

    const response = await request(app)
      .post('/api/templates/registry/admin/graph/seed-thesaurus')
      .send({ domain: 'pyme', insurer: 'mapfre' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(seedGraphFromThesaurus).toHaveBeenCalledWith('pyme', { insurer: 'mapfre' });
  });

  it('rejects non-admin roles', async () => {
    const { app } = buildApp('user');

    const response = await request(app).get('/api/templates/registry/admin/graph/edges');

    expect(response.status).toBe(403);
  });
});
