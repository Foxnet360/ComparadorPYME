import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.warn("⚠️ Dotenv error:", result.error.message);
}

// Map VITE_ variable to standard variable if needed
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}

// Import controllers after dotenv is loaded (they depend on env vars)
import { analysisController } from './controllers/analysisController';
import { ragClauseController } from './controllers/ragClauseController';
import { clauseController } from './controllers/clauseController';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Trigger restart: 1
app.use(cors());
app.use(express.json());

// Basic health check
// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'CSA Comparator API is running', timestamp: new Date().toISOString() });
});

// Root route - API info
app.get('/', (req, res) => {
    res.json({
        name: 'CSA Comparator API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            analyze: '/api/analyze',
            analyzeRag: '/api/analyze-rag',
            history: '/api/history',
            documents: '/api/documents',
            search: '/api/search',
            rag: {
                clauses: '/api/rag/clauses',
                search: '/api/rag/search',
                analyze: '/api/rag/analyze'
            }
        }
    });
});

// Ensure uploads directory exists (Use /tmp for Cloud Run)
const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

// Analysis routes
app.post('/api/analyze',
    upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]),
    analysisController.uploadAndAnalyze
);

// RAG Analysis route (new)
app.post('/api/analyze-rag',
    upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]),
    async (req, res) => {
        try {
            const { ragClauseController } = await import('./controllers/ragClauseController');
            await ragClauseController.analyzeQuote(req, res);
        } catch (error) {
            console.error('RAG Analysis error:', error);
            res.status(500).json({ error: 'RAG analysis failed' });
        }
    }
);

app.get('/api/history', analysisController.getHistory);

// RAG Clause Library routes
app.post('/api/rag/clauses', upload.single('file'), ragClauseController.indexClause);
app.get('/api/rag/clauses', ragClauseController.listClauses);
app.delete('/api/rag/clauses', ragClauseController.deleteClause);
app.post('/api/rag/clauses/:id/reindex', upload.single('file'), ragClauseController.reindexClause);
app.post('/api/rag/analyze', upload.single('file'), ragClauseController.analyzeQuote);
app.post('/api/rag/search', ragClauseController.search);

// Clause Indexing routes (async RAG foundation)
app.post('/api/clauses/index', upload.single('file'), clauseController.indexClause);
app.get('/api/clauses/status/:jobId', clauseController.getJobStatus);
app.get('/api/clauses/jobs', clauseController.listJobs);

// NEW: Document Indexing routes
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
                'GET /api/history',
                'GET /api/documents',
                'POST /api/documents',
                'POST /api/search',
                'POST /api/rag/clauses',
                'GET /api/rag/clauses'
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

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${port}`);
});
