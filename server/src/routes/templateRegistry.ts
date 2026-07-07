/**
 * Template Registry Routes
 * Admin/ops endpoints for managing insurer-specific PDF templates.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createTemplateRegistryService,
  TemplateRegistryService,
} from '../services/templateRegistryService';
import { validateTemplateRegistryEntry, GraphEdgeType } from '../schemas/templateRegistrySchema';
import { buildGraphEdgesFromDomain, seedCoverageGraph } from '../services/graphSeeder';
import { coverageGraphService } from '../services/coverageGraphService';
import { seedGraphFromThesaurus } from '../services/thesaurusMapper';
import { supabase } from '../config/database';

const ADMIN_ROLES = new Set(['admin', 'operator', 'ops']);

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const role = req.user?.role;
  if (!role || !ADMIN_ROLES.has(role)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin or operator access required',
    });
    return;
  }
  next();
}

function getDomain(req: Request): string {
  const value = req.query.domain;
  return typeof value === 'string' ? value : 'pyme';
}

export function createTemplateRegistryRoutes(service: TemplateRegistryService): Router {
  const router = Router();

  router.use(authMiddleware);
  router.use(requireAdmin);

  /**
   * GET /api/templates/registry
   * List merged templates (DB overrides seeds) for a domain.
   */
  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const templates = await service.loadTemplates(domain);
      res.json({ domain, templates });
    })
  );

  /**
   * POST /api/templates/registry
   * Create or update a template.
   */
  router.post(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const parsed = validateTemplateRegistryEntry(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid template entry',
          issues: parsed.error?.issues,
        });
        return;
      }
      await service.upsertTemplate(parsed.data, domain);
      res.json({ success: true, templateId: parsed.data.templateId, domain });
    })
  );

  /**
   * ---------------------------------------------------------------------------
   * Admin graph routes (must be defined before /:templateId)
   * ---------------------------------------------------------------------------
   */

  /**
   * POST /api/templates/registry/admin/seed-graph
   * Seed coverage graph edges from the domain bundle.
   */
  router.post(
    '/admin/seed-graph',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const edges = buildGraphEdgesFromDomain(domain);
      await seedCoverageGraph(supabase, domain, edges);
      res.json({ success: true, domain, edgesSeeded: edges.length });
    })
  );

  /**
   * GET /api/templates/registry/admin/graph/edges
   * List coverage graph edges with optional filters.
   */
  router.get(
    '/admin/graph/edges',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const { from, to, type, insurer } = req.query;
      const edges = await coverageGraphService.listEdges({
        from: typeof from === 'string' ? from : undefined,
        to: typeof to === 'string' ? to : undefined,
        type: typeof type === 'string' ? (type as GraphEdgeType) : undefined,
        insurer: typeof insurer === 'string' ? insurer : undefined,
        domain,
      });
      res.json({ success: true, domain, edges });
    })
  );

  /**
   * POST /api/templates/registry/admin/graph/edges
   * Add a single coverage graph edge.
   */
  router.post(
    '/admin/graph/edges',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const edge = req.body;
      await coverageGraphService.addEdge({ ...edge, domain });
      res.json({ success: true, domain, edge });
    })
  );

  /**
   * DELETE /api/templates/registry/admin/graph/edges
   * Delete a coverage graph edge.
   */
  router.delete(
    '/admin/graph/edges',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const { from, to, type, insurer } = req.query;
      if (!from || !to || !type) {
        res.status(400).json({ error: 'Bad Request', message: 'from, to, and type are required' });
        return;
      }
      await coverageGraphService.deleteEdge(
        from as string,
        to as string,
        type as unknown as GraphEdgeType,
        typeof insurer === 'string' ? insurer : undefined,
        domain
      );
      res.json({ success: true, domain });
    })
  );

  /**
   * POST /api/templates/registry/admin/graph/corrections
   * Learn from an analyst correction.
   */
  router.post(
    '/admin/graph/corrections',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const { raw, canonical, insurer } = req.body;
      if (!raw || !canonical) {
        res.status(400).json({ error: 'Bad Request', message: 'raw and canonical are required' });
        return;
      }
      await coverageGraphService.learnCorrection(raw, canonical, insurer, domain);
      res.json({ success: true, domain });
    })
  );

  /**
   * POST /api/templates/registry/admin/graph/seed-thesaurus
   * Seed coverage graph alias edges from the thesaurus.
   */
  router.post(
    '/admin/graph/seed-thesaurus',
    asyncHandler(async (req: Request, res: Response) => {
      const domain = getDomain(req);
      const { insurer } = req.body;
      await seedGraphFromThesaurus(domain, { insurer });
      res.json({ success: true, domain, insurer });
    })
  );

  /**
   * GET /api/templates/registry/:templateId
   * Get a single template.
   */
  router.get(
    '/:templateId',
    asyncHandler(async (req: Request, res: Response) => {
      const templateId = req.params.templateId as string;
      const domain = getDomain(req);
      const template = service.getTemplate(templateId, domain);

      if (!template) {
        res.status(404).json({ error: 'Not Found', message: `Template ${templateId} not found` });
        return;
      }

      res.json({ domain, template });
    })
  );

  /**
   * DELETE /api/templates/registry/:templateId
   * Deactivate/delete a template.
   */
  router.delete(
    '/:templateId',
    asyncHandler(async (req: Request, res: Response) => {
      const templateId = req.params.templateId as string;
      const domain = getDomain(req);
      await service.deleteTemplate(templateId, domain);
      res.json({ success: true, templateId, domain });
    })
  );

  /**
   * POST /api/templates/registry/:templateId/refresh-cache
   * Invalidate cache for a template and reload the registry.
   */
  router.post(
    '/:templateId/refresh-cache',
    asyncHandler(async (req: Request, res: Response) => {
      const templateId = req.params.templateId as string;
      const domain = getDomain(req);
      await service.invalidateCache(templateId, domain);
      await service.loadTemplates(domain);
      res.json({ success: true, templateId, domain });
    })
  );

  return router;
}

const defaultService = createTemplateRegistryService({ db: supabase });

export default createTemplateRegistryRoutes(defaultService);
