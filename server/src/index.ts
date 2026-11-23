import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { asyncHandler } from './utils/asyncHandler';
import { requireRole } from './middleware/auth';

const rootEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

let envPath = rootEnvPath;
let result = dotenv.config({ path: envPath });

if (result.error) {
  // Fallback to server/.env for backward compatibility
  result = dotenv.config({ path: serverEnvPath });
  if (!result.error) {
    console.warn(
      '⚠️ [DEPRECATION] Using server/.env is deprecated. Please move your .env file to the project root.'
    );
    envPath = serverEnvPath;
  } else {
    console.warn('⚠️ Dotenv error:', result.error.message);
  }
}

// Map VITE_ variable to standard variable if needed
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

// Diagnostic logging for API key status
const activeKey = process.env.GEMINI_API_KEY || '';
const viteKey = process.env.VITE_GEMINI_API_KEY || '';
console.log(`🔑 [Env Diagnostic] GEMINI_API_KEY present: ${activeKey ? 'yes' : 'no'}`);
console.log(`🔑 [Env Diagnostic] VITE_GEMINI_API_KEY present: ${viteKey ? 'yes' : 'no'}`);
if (activeKey && viteKey && activeKey !== viteKey) {
  console.warn(
    '⚠️ [Env Diagnostic] GEMINI_API_KEY and VITE_GEMINI_API_KEY differ; GEMINI_API_KEY will be used'
  );
}

// Import controllers after dotenv is loaded (they depend on env vars)
import { analysisController } from './controllers/analysisController';
import { compareExtraction } from './controllers/compareController';
import { assertProductionJwtSecret } from './middleware/auth';
import { authGate } from './middleware/authGate';
import { globalRateLimiter, analyzeRateLimiter, chatRateLimiter } from './middleware/rateLimiter';
import { createCorsOrigin, getCorsOrigins } from './config/cors';

// Import routes
import auditRoutes from './routes/audit';
import chatRoutes from './routes/chat';
import analysisRoutes from './routes/analysis';
import comparisonRoutes from './routes/comparisonRoutes';
import monitoringRoutes from './routes/monitoring';
import templateRegistryRoutes from './routes/templateRegistry';
import clientRoutes from './routes/clientRoutes';
import policyRoutes from './routes/policyRoutes';
import renewalRoutes from './routes/renewalRoutes';
import campaignRoutes from './routes/campaignRoutes';
import insurerRoutes from './routes/insurers';
import organizationRoutes from './routes/organizationRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import daasRoutes from './routes/daasRoutes';

// Graph seeding lifecycle
import { buildGraphEdgesFromDomain, seedCoverageGraph } from './services/graphSeeder';
import { supabase } from './config/database';
import { startCampaignScheduler, stopCampaignScheduler } from './services/campaignScheduler';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Railway (and most PaaS proxies) sets X-Forwarded-For. Without trust proxy,
// express-rate-limit emits ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and keys every
// client as the proxy IP. Exactly one proxy hop sits in front of this app.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Request ID middleware
import { v4 as uuidv4 } from 'uuid';
app.use((req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Dynamic CORS configuration (fail-closed: disallowed origins are rejected)
const corsOrigins = getCorsOrigins();
console.log('🌐 [CORS] Allowed origins:', corsOrigins);

app.use(
  cors({
    origin: createCorsOrigin(corsOrigins),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// SEC-4: global rate limit on all /api traffic. Runs before the auth gate
// so unauthenticated floods are also throttled.
app.use('/api', globalRateLimiter);

// AUTH-1: global authentication gate. MUST stay before any /api route
// registration so every non-allowlisted /api/* route requires a Bearer token
// (fail-closed). Coverage: tests/server/routeAuthCoverage.test.ts.
app.use('/api', authGate);

// Health check with dependency status
import { checkHealth } from './services/healthCheckService';
app.get('/health', async (req, res) => {
  try {
    const health = await checkHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;
    res.status(statusCode).json(health);
  } catch (_error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Failed to perform health check',
    });
  }
});

import { featureFlags } from './config/featureFlags';
import { getUnifiedOpenApiDocument } from './config/openApiSpec';
import { documentController } from './controllers/documentController';
import { searchController } from './controllers/searchController';

// Ensure uploads directory exists (Use /tmp for Cloud Run)
const uploadDir =
  process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
    files: 25,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.mimetype === 'application/pdf' && ext === '.pdf') {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files are allowed'));
  },
});

function loadOpenApiYaml(): string {
  const candidates = [
    path.resolve(__dirname, '../../docs/openapi.yaml'),
    path.resolve(process.cwd(), 'docs/openapi.yaml'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf-8');
    }
  }
  return '';
}

function registerCoreApiRoutes(prefix: '/api' | '/api/v1'): void {
  // Root route - API metadata and versioning catalog
  app.get(prefix, (_req, res) => {
    res.json({
      name: 'CSA Comparator API',
      version: '2.0.0',
      apiVersion: 'v1',
      currentPrefix: '/api/v1',
      legacyPrefix: '/api',
      openapi: '/api/v1/openapi.json',
      status: 'running',
      features: {
        multimodalExtraction: true,
        legacyFallback: true,
      },
      endpoints: {
        health: '/health',
        openapiJson: `${prefix}/openapi.json`,
        openapiYaml: `${prefix}/openapi.yaml`,
        features: `${prefix}/features`,
        analyze: `${prefix}/analyze`,
        compareExtraction: `${prefix}/compare-extraction (V1 vs V2)`,
        history: `${prefix}/history`,
        documents: `${prefix}/documents`,
        search: `${prefix}/search`,
        audit: `${prefix}/audit/enrich`,
        chat: `${prefix}/chat`,
        daas: '/api/v1/daas',
      },
    });
  });

  // Feature flags endpoint
  app.get(`${prefix}/features`, (_req, res) => {
    res.json({
      flags: featureFlags.getFlags(),
      legacyMode: featureFlags.isLegacyMode(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Unified OpenAPI 3.0.3 documentation endpoints
  app.get(`${prefix}/openapi.json`, (_req, res) => {
    res.json(getUnifiedOpenApiDocument());
  });

  app.get(`${prefix}/openapi.yaml`, (_req, res) => {
    const yaml = loadOpenApiYaml();
    if (!yaml) {
      res.status(404).json({ error: 'Not Found', message: 'OpenAPI YAML specification not found' });
      return;
    }
    res.type('application/yaml; charset=utf-8').send(yaml);
  });

  // Compare V1 vs V2 endpoint
  app.post(
    `${prefix}/compare-extraction`,
    analyzeRateLimiter,
    upload.array('quotes', 10),
    compareExtraction
  );

  // Analysis routes
  app.post(
    `${prefix}/analyze`,
    analyzeRateLimiter,
    upload.fields([
      { name: 'quotes', maxCount: 15 },
      { name: 'clauses', maxCount: 10 },
    ]),
    asyncHandler(analysisController.uploadAndAnalyze)
  );

  app.post(
    `${prefix}/analysis/:id/quotes`,
    analyzeRateLimiter,
    upload.fields([{ name: 'quotes', maxCount: 15 }]),
    asyncHandler(analysisController.appendQuotesToAnalysis)
  );

  app.patch(`${prefix}/analysis/:id/status`, asyncHandler(analysisController.updateAnalysisStatus));

  app.get(`${prefix}/history`, asyncHandler(analysisController.getHistory));

  // Document management (upload allowed for super_admin, ally_admin, ally_technical; delete restricted to admins)
  app.post(
    `${prefix}/documents`,
    requireRole('super_admin', 'ally_admin', 'ally_technical'),
    documentController.uploadMiddleware,
    documentController.createDocument
  );
  app.get(`${prefix}/documents`, documentController.listDocuments);
  app.get(`${prefix}/documents/check-existing`, documentController.checkExistingClause);
  app.get(`${prefix}/documents/:id`, documentController.getDocument);
  app.delete(
    `${prefix}/documents/:id`,
    requireRole('super_admin', 'ally_admin'),
    documentController.deleteDocument
  );
  app.get(`${prefix}/documents/:id/chunks`, documentController.getDocumentChunks);

  // Search routes
  app.post(`${prefix}/search`, searchController.search);
  app.post(`${prefix}/search/by-coverage`, searchController.searchByCoverage);
  app.post(`${prefix}/search/compare`, searchController.compareDocuments);
}

registerCoreApiRoutes('/api');
registerCoreApiRoutes('/api/v1');

// Router mounts: single source of truth consumed by the route-coverage test.
// The gate already applies optional auth to allowlisted prefixes, so no
// per-mount auth middleware is needed here. SEC-4: analysis and chat mounts
// carry their stricter rate limiters.
const coreRouterMounts = [
  { suffix: '/audit', router: auditRoutes },
  { suffix: '/analysis', middleware: [analyzeRateLimiter], router: analysisRoutes },
  { suffix: '/chat', middleware: [chatRateLimiter], router: chatRoutes },
  { suffix: '/monitoring', router: monitoringRoutes },
  { suffix: '/templates/registry', router: templateRegistryRoutes },
  { suffix: '/comparison', router: comparisonRoutes },
  { suffix: '/clients', router: clientRoutes },
  { suffix: '/policies', router: policyRoutes },
  { suffix: '/renewals', router: renewalRoutes },
  { suffix: '/campaigns', router: campaignRoutes },
  { suffix: '/insurers', router: insurerRoutes },
  { suffix: '/organizations', router: organizationRoutes },
  { suffix: '/analytics', router: analyticsRoutes },
] as const;

export const apiRouterMounts = [
  ...coreRouterMounts.map((mount) => ({
    prefix: `/api${mount.suffix}`,
    ...('middleware' in mount ? { middleware: mount.middleware } : {}),
    router: mount.router,
  })),
  ...coreRouterMounts.map((mount) => ({
    prefix: `/api/v1${mount.suffix}`,
    ...('middleware' in mount ? { middleware: mount.middleware } : {}),
    router: mount.router,
  })),
  { prefix: '/api/v1/daas', router: daasRoutes },
] as const;

for (const mount of apiRouterMounts) {
  if ('middleware' in mount && mount.middleware) {
    app.use(mount.prefix, ...mount.middleware, mount.router);
  } else {
    app.use(mount.prefix, mount.router);
  }
}

// Centralized error handling middleware (must be after all routes)
import { errorHandler } from './middleware/errorHandler';
app.use(errorHandler);

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../dist');
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));

    // Serve index.html for all non-API routes (SPA support)
    app.use((req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(staticPath, 'index.html'));
      } else {
        res.status(404).json({
          error: 'Not Found',
          message: `Route ${req.method} ${req.path} not found`,
        });
      }
    });
  }
} else {
  // Catch-all route for undefined paths (development)
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`,
      availableEndpoints: [
        'GET /',
        'GET /health',
        'POST /api/analyze',
        'POST /api/analyze-rag',
        'POST /api/compare-extraction (V1 vs V2)',
        'GET /api/history',
        'GET /api/documents',
        'POST /api/documents',
        'POST /api/search',
        'POST /api/audit/enrich',
        'POST /api/chat',
        'POST /api/chat/suggestions',
      ],
    });
  });
}

console.log('🚀 About to start server...');
console.log('📍 Port:', port);
console.log('📍 Host: 0.0.0.0');
console.log('📍 NODE_ENV:', process.env.NODE_ENV);
console.log('📍 Static path:', path.join(__dirname, '../../dist'));
console.log('📍 Static exists:', fs.existsSync(path.join(__dirname, '../../dist')));

async function seedCoverageGraphOnStartup(): Promise<void> {
  if (!featureFlags.isEnabled('useTemplateGraphPipeline')) {
    return;
  }

  try {
    const edges = buildGraphEdgesFromDomain('pyme');
    await seedCoverageGraph(supabase, 'pyme', edges);
    console.log(`🌱 Seeded ${edges.length} coverage graph edges on startup`);
  } catch (error) {
    console.error('❌ Failed to seed coverage graph on startup:', error);
  }
}

export interface GracefulShutdownDeps {
  server: { close: (cb: (err?: Error) => void) => void };
  stopScheduler?: () => void;
  exitFn?: (code: number) => void;
  timeoutMs?: number;
}

export function createGracefulShutdown({
  server,
  stopScheduler = stopCampaignScheduler,
  exitFn = (code) => process.exit(code),
  timeoutMs = 10000,
}: GracefulShutdownDeps) {
  let shuttingDown = false;

  return (signal: string): Promise<void> => {
    if (shuttingDown) {
      return Promise.resolve();
    }
    shuttingDown = true;
    console.log(`🛑 [Shutdown] Received ${signal}, draining HTTP server...`);

    try {
      stopScheduler();
    } catch (err) {
      console.error('❌ [Shutdown] Error stopping campaign scheduler:', err);
    }

    return new Promise((resolve) => {
      const forceTimer = setTimeout(() => {
        console.error(`⚠️ [Shutdown] Force exiting after ${timeoutMs}ms timeout`);
        exitFn(1);
        resolve();
      }, timeoutMs);
      forceTimer.unref?.();

      server.close((err) => {
        clearTimeout(forceTimer);
        if (err) {
          console.error('❌ [Shutdown] Error closing HTTP server:', err);
          exitFn(1);
        } else {
          console.log('✅ [Shutdown] HTTP server closed cleanly');
          exitFn(0);
        }
        resolve();
      });
    });
  };
}

async function bootstrap(): Promise<void> {
  // SEC-2: fail before binding the port when mandatory config is missing
  try {
    assertProductionJwtSecret();
  } catch (error) {
    console.error('❌ [Startup]', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  await seedCoverageGraphOnStartup();

  // renovacion-polizas PR-4: campaign scheduler (design Q3). Guarded entry —
  // schedules nothing unless CAMPAIGN_SCHEDULER_ENABLED=true. A scheduler
  // failure must never block startup.
  try {
    startCampaignScheduler();
  } catch (error) {
    console.error('❌ [Startup] campaign scheduler failed to start:', error);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${port}`);
  });
  server.setTimeout(Number(process.env.UPLOAD_TIMEOUT) || 300000);

  const handleSignal = createGracefulShutdown({ server });
  process.once('SIGTERM', () => {
    void handleSignal('SIGTERM');
  });
  process.once('SIGINT', () => {
    void handleSignal('SIGINT');
  });
}

// Start only when run as a server, not when imported by tests (vitest sets VITEST).
// Production start goes through the root index.js -> server/dist/index.js chain,
// so a require.main check is not safe here.
if (!process.env.VITEST) {
  void bootstrap();
}

export { app };
