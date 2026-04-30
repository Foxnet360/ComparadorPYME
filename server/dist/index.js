"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const envPath = path_1.default.resolve(__dirname, '../.env');
const result = dotenv_1.default.config({ path: envPath });
if (result.error) {
    console.warn("⚠️ Dotenv error:", result.error.message);
}
// Map VITE_ variable to standard variable if needed
if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
}
// Import controllers after dotenv is loaded (they depend on env vars)
const analysisController_1 = require("./controllers/analysisController");
const ragClauseController_1 = require("./controllers/ragClauseController");
const clauseController_1 = require("./controllers/clauseController");
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || '8080', 10);
// Trigger restart: 1
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
const uploadDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir);
}
const upload = (0, multer_1.default)({ dest: uploadDir });
// Analysis routes
app.post('/api/analyze', upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]), analysisController_1.analysisController.uploadAndAnalyze);
// RAG Analysis route (new)
app.post('/api/analyze-rag', upload.fields([{ name: 'quotes', maxCount: 10 }, { name: 'clauses', maxCount: 10 }]), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { ragClauseController } = yield Promise.resolve().then(() => __importStar(require('./controllers/ragClauseController')));
        yield ragClauseController.analyzeQuote(req, res);
    }
    catch (error) {
        console.error('RAG Analysis error:', error);
        res.status(500).json({ error: 'RAG analysis failed' });
    }
}));
app.get('/api/history', analysisController_1.analysisController.getHistory);
// RAG Clause Library routes
app.post('/api/rag/clauses', upload.single('file'), ragClauseController_1.ragClauseController.indexClause);
app.get('/api/rag/clauses', ragClauseController_1.ragClauseController.listClauses);
app.delete('/api/rag/clauses', ragClauseController_1.ragClauseController.deleteClause);
app.post('/api/rag/clauses/:id/reindex', upload.single('file'), ragClauseController_1.ragClauseController.reindexClause);
app.post('/api/rag/analyze', upload.single('file'), ragClauseController_1.ragClauseController.analyzeQuote);
app.post('/api/rag/search', ragClauseController_1.ragClauseController.search);
// Clause Indexing routes (async RAG foundation)
app.post('/api/clauses/index', upload.single('file'), clauseController_1.clauseController.indexClause);
app.get('/api/clauses/status/:jobId', clauseController_1.clauseController.getJobStatus);
app.get('/api/clauses/jobs', clauseController_1.clauseController.listJobs);
// NEW: Document Indexing routes
const documentController_1 = require("./controllers/documentController");
const searchController_1 = require("./controllers/searchController");
// Document management
app.post('/api/documents', documentController_1.documentController.uploadMiddleware, documentController_1.documentController.createDocument);
app.get('/api/documents', documentController_1.documentController.listDocuments);
app.get('/api/documents/:id', documentController_1.documentController.getDocument);
app.delete('/api/documents/:id', documentController_1.documentController.deleteDocument);
app.get('/api/documents/:id/chunks', documentController_1.documentController.getDocumentChunks);
// Search routes
app.post('/api/search', searchController_1.searchController.search);
app.post('/api/search/by-coverage', searchController_1.searchController.searchByCoverage);
app.post('/api/search/compare', searchController_1.searchController.compareDocuments);
// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
    const staticPath = path_1.default.join(__dirname, '../../dist');
    if (fs_1.default.existsSync(staticPath)) {
        app.use(express_1.default.static(staticPath));
        // Serve index.html for all non-API routes (SPA support)
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api')) {
                res.sendFile(path_1.default.join(staticPath, 'index.html'));
            }
            else {
                res.status(404).json({
                    error: 'Not Found',
                    message: `Route ${req.method} ${req.path} not found`
                });
            }
        });
    }
}
else {
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
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
