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

// Import routes
import auditRoutes from './routes/audit';
import chatRoutes from './routes/chat';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Trigger restart: 1
app.use(cors({
    origin: ['https://compapyme.baconhacks.com', 'http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Basic health check
// Basic health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'CSA Comparator API is running', timestamp: new Date().toISOString() });
});

// Root route - API info (only if not serving static files)
app.get('/api', (req, res) => {
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
            audit: '/api/audit/enrich',
            chat: '/api/chat'
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

// NEW: Chat routes
app.use('/api/chat', chatRoutes);

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

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${port}`);
});
