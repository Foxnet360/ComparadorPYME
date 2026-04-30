"use strict";
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
exports.ragClauseController = void 0;
const pdfExtractor_1 = require("../services/pdfExtractor");
const semanticChunker_1 = require("../services/semanticChunker");
const embeddingService_1 = require("../services/vector/embeddingService");
const vectorStore_1 = require("../services/vectorStore");
const ragRetrieval_1 = require("../services/ragRetrieval");
const groqService_1 = require("../services/groqService");
const fs_1 = __importDefault(require("fs"));
const indexedClauses = new Map();
exports.ragClauseController = {
    /**
     * POST /api/rag/clauses - Upload and index a new clause document
     */
    indexClause: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }
            const { insurerName, documentName, documentType } = req.body;
            if (!insurerName || !documentName) {
                res.status(400).json({ error: 'Missing required fields: insurerName, documentName' });
                return;
            }
            const validation = pdfExtractor_1.pdfExtractor.validatePdf(file.path);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }
            const extractionResult = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(file.path);
            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }
            const pages = extractionResult.text.split('\n\n');
            const pageBoundaries = semanticChunker_1.semanticChunker.calculatePageBoundaries(pages);
            const chunks = semanticChunker_1.semanticChunker.createChunks(extractionResult.text, {
                documentName: file.originalname,
                insurerName,
            }, pageBoundaries);
            const chunksWithEmbeddings = yield Promise.all(chunks.map((chunk, index) => __awaiter(void 0, void 0, void 0, function* () {
                const embedding = yield embeddingService_1.embeddingService.generateEmbedding(chunk.content);
                return {
                    id: `${insurerName.toLowerCase().replace(/\s+/g, '_')}_${index}`,
                    content: chunk.content,
                    metadata: Object.assign(Object.assign({}, chunk.metadata), { insurerName, documentName: file.originalname, documentType: documentType || 'CLAUSULADO_GENERAL' }),
                    embedding,
                };
            })));
            yield vectorStore_1.vectorStore.addChunks(insurerName, chunksWithEmbeddings);
            const clauseId = `${insurerName.toLowerCase()}_${Date.now()}`;
            indexedClauses.set(clauseId, {
                id: clauseId,
                insurerName,
                documentName: file.originalname,
                indexedAt: new Date(),
                chunkCount: chunks.length,
            });
            try {
                fs_1.default.unlinkSync(file.path);
            }
            catch (e) {
                console.error('Failed to delete temp file', e);
            }
            res.status(201).json({
                success: true,
                clauseId,
                insurerName,
                documentName: file.originalname,
                chunkCount: chunks.length,
                metadata: extractionResult.metadata,
            });
        }
        catch (error) {
            console.error('Error indexing clause:', error);
            res.status(500).json({ error: error.message || 'Failed to index clause' });
        }
    }),
    /**
     * GET /api/rag/clauses - List indexed clause documents
     */
    listClauses: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const insurerName = req.query.insurer;
            const documents = yield vectorStore_1.vectorStore.listDocuments(insurerName);
            const clauses = documents.map(doc => ({
                insurerName: doc.insurerName,
                documentName: doc.documentName,
                chunkCount: doc.chunkCount,
            }));
            res.json(clauses);
        }
        catch (error) {
            console.error('Error listing clauses:', error);
            res.status(500).json({ error: error.message || 'Failed to list clauses' });
        }
    }),
    /**
     * DELETE /api/rag/clauses - Delete indexed clause
     */
    deleteClause: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { insurerName, documentName } = req.body;
            if (!insurerName || !documentName) {
                res.status(400).json({ error: 'Missing insurerName or documentName' });
                return;
            }
            yield vectorStore_1.vectorStore.deleteDocument(insurerName, documentName);
            res.status(200).json({ success: true, message: 'Clause deleted' });
        }
        catch (error) {
            console.error('Error deleting clause:', error);
            res.status(500).json({ error: error.message || 'Failed to delete clause' });
        }
    }),
    /**
     * POST /api/rag/clauses/:id/reindex - Re-index an existing clause document
     */
    reindexClause: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            const id = String(req.params.id);
            const file = req.file;
            const { insurerName, documentName, documentType } = req.body;
            if (!file) {
                res.status(400).json({ error: 'No file uploaded for re-indexing' });
                return;
            }
            const targetInsurerName = insurerName || ((_a = indexedClauses.get(id)) === null || _a === void 0 ? void 0 : _a.insurerName);
            const targetDocumentName = documentName || ((_b = indexedClauses.get(id)) === null || _b === void 0 ? void 0 : _b.documentName);
            if (!targetInsurerName || !targetDocumentName) {
                res.status(400).json({ error: 'Missing insurerName or documentName' });
                return;
            }
            yield vectorStore_1.vectorStore.deleteDocument(targetInsurerName, targetDocumentName);
            const extractionResult = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(file.path);
            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }
            const pages = extractionResult.text.split('\n\n');
            const pageBoundaries = semanticChunker_1.semanticChunker.calculatePageBoundaries(pages);
            const chunks = semanticChunker_1.semanticChunker.createChunks(extractionResult.text, {
                documentName: file.originalname,
                insurerName: targetInsurerName,
            }, pageBoundaries);
            const chunksWithEmbeddings = yield Promise.all(chunks.map((chunk, index) => __awaiter(void 0, void 0, void 0, function* () {
                const embedding = yield embeddingService_1.embeddingService.generateEmbedding(chunk.content);
                return {
                    id: `${targetInsurerName.toLowerCase().replace(/\s+/g, '_')}_${index}`,
                    content: chunk.content,
                    metadata: Object.assign(Object.assign({}, chunk.metadata), { insurerName: targetInsurerName, documentName: file.originalname, documentType: documentType || 'CLAUSULADO_GENERAL' }),
                    embedding,
                };
            })));
            yield vectorStore_1.vectorStore.addChunks(targetInsurerName, chunksWithEmbeddings);
            indexedClauses.set(id, {
                id,
                insurerName: targetInsurerName,
                documentName: file.originalname,
                indexedAt: new Date(),
                chunkCount: chunks.length,
            });
            try {
                fs_1.default.unlinkSync(file.path);
            }
            catch (e) {
                console.error('Failed to delete temp file', e);
            }
            res.status(200).json({
                success: true,
                clauseId: id,
                insurerName: targetInsurerName,
                documentName: file.originalname,
                chunkCount: chunks.length,
                message: 'Clause re-indexed successfully',
            });
        }
        catch (error) {
            console.error('Error re-indexing clause:', error);
            res.status(500).json({ error: error.message || 'Failed to re-index clause' });
        }
    }),
    /**
     * POST /api/rag/analyze - Analyze a quote with RAG
     */
    analyzeQuote: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const file = req.file;
            const { insurerName, coverageTerms } = req.body;
            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }
            const extractionResult = yield pdfExtractor_1.pdfExtractor.extractTextFromPdf(file.path);
            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }
            const terms = coverageTerms
                ? JSON.parse(coverageTerms)
                : ['cobertura', 'exclusiones', 'deducibles', 'límites', 'condiciones'];
            const retrievalResult = yield ragRetrieval_1.ragRetrieval.retrieveWithTerms(terms, insurerName, 3);
            const analysisResult = yield groqService_1.groqService.analyzeQuote(extractionResult.text, {
                chunks: retrievalResult.chunks.map(c => c.content),
                citations: retrievalResult.citations,
            });
            analysisResult.citations = ragRetrieval_1.ragRetrieval.buildCitations(retrievalResult.chunks);
            try {
                fs_1.default.unlinkSync(file.path);
            }
            catch (e) {
                console.error('Failed to delete temp file', e);
            }
            res.json({
                quote: analysisResult,
                retrievalStats: {
                    chunksRetrieved: retrievalResult.chunks.length,
                    termsUsed: terms,
                },
            });
        }
        catch (error) {
            console.error('Error analyzing quote:', error);
            res.status(500).json({ error: error.message || 'Failed to analyze quote' });
        }
    }),
    /**
     * POST /api/rag/search - Search clauses
     */
    search: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { query, insurerName, limit } = req.body;
            if (!query) {
                res.status(400).json({ error: 'Missing query' });
                return;
            }
            const results = yield ragRetrieval_1.ragRetrieval.retrieve(query, insurerName, limit || 5);
            res.json({
                query,
                results: results.chunks.map(chunk => ({
                    id: chunk.id,
                    content: chunk.content.substring(0, 500),
                    metadata: chunk.metadata,
                    distance: chunk.distance,
                })),
            });
        }
        catch (error) {
            console.error('Error searching:', error);
            res.status(500).json({ error: error.message || 'Failed to search' });
        }
    }),
};
