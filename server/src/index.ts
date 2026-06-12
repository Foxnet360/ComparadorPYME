import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const rootEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

let envPath = rootEnvPath;
let result = dotenv.config({ path: envPath });

if (result.error) {
    // Fallback to server/.env for backward compatibility
    result = dotenv.config({ path: serverEnvPath });
    if (!result.error) {
        console.warn("⚠️ [DEPRECATION] Using server/.env is deprecated. Please move your .env file to the project root.");
        envPath = serverEnvPath;
    } else {
        console.warn("⚠️ Dotenv error:", result.error.message);
    }
}

// Map VITE_ variable to standard variable if needed
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

// Import controllers after dotenv is loaded (they depend on env vars)
import { analysisController } from './controllers/analysisController';
import { compareExtraction } from './controllers/compareController';

// Import routes
import auditRoutes from './routes/audit';
import chatRoutes from './routes/chat';
import analysisRoutes from './routes/analysis';
import comparisonRoutes from './routes/comparisonRoutes';
import monitoringRoutes from './routes/monitoring';
import templateRegistryRoutes from './routes/templateRegistry';

// Graph seeding lifecycle
import { buildGraphEdgesFromDomain, seedCoverageGraph } from './services/graphSeeder';
import { supabase } from './config/database';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Request ID middleware
import { v4 as uuidv4 } from 'uuid';
app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
});

// Dynamic CORS configuration
let corsOrigins: string[] = ['http://localhost:3000', 'http://localhost:8080'];
try {
    if (process.env.CORS_ORIGINS) {
        const parsed = JSON.parse(process.env.CORS_ORIGINS);
        if (Array.isArray(parsed)) {
            corsOrigins = parsed;
            console.log('🌐 [CORS] Using configured origins:', corsOrigins);
        } else {
            console.warn('⚠️ [CORS] CORS_ORIGINS is not a valid JSON array, using defaults');
        }
    } else {
        console.log('🌐 [CORS] Using default origins:', corsOrigins);
    }
} catch (error) {
    console.error('❌ [CORS] Failed to parse CORS_ORIGINS:', error);
    console.log('🌐 [CORS] Using default origins:', corsOrigins);
}

app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check with dependency status
import { checkHealth } from './services/healthCheckService';
app.get('/health', async (req, res) => {
    try {
        const health = await checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Failed to perform health check'
        });
    }
});

// Root route - API info (only if not serving static files)
app.get('/api', (req, res) => {
    res.json({
        name: 'CSA Comparator API',
        version: '2.0.0',
        status: 'running',
        features: {
            multimodalExtraction: true,
            legacyFallback: true
        },
        endpoints: {
            health: '/health',
            analyze: '/api/analyze',
            analyzeRag: '/api/analyze-rag',
            compareExtraction: '/api/compare-extraction (V1 vs V2)',
            history: '/api/history',
            documents: '/api/documents',
            search: '/api/search',
            audit: '/api/audit/enrich',
            chat: '/api/chat'
        }
    });
});

// Feature flags endpoint
import { featureFlags } from './config/featureFlags';
app.get('/api/features', (req, res) => {
    res.json({
        flags: featureFlags.getFlags(),
        legacyMode: featureFlags.isLegacyMode(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Ensure uploads directory exists (Use /tmp for Cloud Run)
const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

// Compare V1 vs V2 endpoint
app.post('/api/compare-extraction',
    upload.array('quotes', 10),
    compareExtraction
);

// Analysis routes
app.post('/api/analyze',
    upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]),
    analysisController.uploadAndAnalyze
);

app.get('/api/history', analysisController.getHistory);

// Document Indexing routes
import { documentController } from './controllers/documentController';
import { searchController } from './controllers/searchController';

// Document management
app.post('/api/documents',
    documentController.uploadMiddleware,
    documentController.createDocument
);
app.get('/api/documents', documentController.listDocuments);
app.get('/api/documents/:id', documentController.getDocument);
app.delete('/api/documents/:id', documentController.deleteDocument);
app.get('/api/documents/:id/chunks', documentController.getDocumentChunks);

// Search routes
app.post('/api/search', searchController.search);
app.post('/api/search/by-coverage', searchController.searchByCoverage);
app.post('/api/search/compare', searchController.compareDocuments);

// NEW: Audit enrichment routes
app.use('/api/audit', auditRoutes);

// NEW: Analysis validation routes
app.use('/api/analysis', analysisRoutes);

// NEW: Chat routes
app.use('/api/chat', chatRoutes);

// NEW: Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// NEW: Template registry routes
app.use('/api/templates/registry', templateRegistryRoutes);

// NEW: Unified Comparison routes
app.use('/api/comparison', comparisonRoutes);

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
                    message: `Route ${req.method} ${req.path} not found`
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
                'POST /api/chat/suggestions'
            ]
        });
    });
}

console.log('🚀 About to start server...');
console.log('📍 Port:', port);
console.log('📍 Host: 0.0.0.0');
console.log('📍 NODE_ENV:', process.env.NODE_ENV);
console.log('📍 Static path:', path.join(__dirname, '../../dist'));
console.log('📍 Static exists:', fs.existsSync(path.join(__dirname, '../../dist')));

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

async function bootstrap(): Promise<void> {
    await seedCoverageGraphOnStartup();

    app.listen(port, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${port}`);
    });
}

bootstrap();
