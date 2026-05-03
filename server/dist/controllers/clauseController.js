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
Object.defineProperty(exports, "__esModule", { value: true });
exports.clauseController = void 0;
const clauseIndexer_1 = require("../services/clauseIndexer");
exports.clauseController = {
    /**
     * Start async indexing of a clause document
     * POST /api/clauses/index
     */
    indexClause: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }
            const { insurerName, documentType, documentName } = req.body;
            if (!insurerName || !documentName) {
                res.status(400).json({
                    error: 'Missing required fields: insurerName, documentName'
                });
                return;
            }
            const jobId = yield clauseIndexer_1.clauseIndexer.startIndexing(file.path, {
                insurerName,
                documentType: documentType || 'CLAUSULADO_GENERAL',
                documentName
            });
            res.status(202).json({
                success: true,
                jobId,
                message: 'Clause indexing started',
                statusUrl: `/api/clauses/status/${jobId}`
            });
        }
        catch (error) {
            console.error('❌ [clauseController] Error starting indexing:', error);
            res.status(500).json({
                error: 'Failed to start clause indexing',
                details: error.message
            });
        }
    }),
    /**
     * Get indexing job status
     * GET /api/clauses/status/:jobId
     */
    getJobStatus: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const jobId = req.params.jobId;
            const job = clauseIndexer_1.clauseIndexer.getJobStatus(jobId);
            if (!job) {
                res.status(404).json({ error: 'Job not found' });
                return;
            }
            res.json({
                jobId: job.id,
                status: job.status,
                progress: job.progress,
                message: job.message,
                documentId: job.documentId,
                error: job.error
            });
        }
        catch (error) {
            console.error('❌ [clauseController] Error getting job status:', error);
            res.status(500).json({
                error: 'Failed to get job status',
                details: error.message
            });
        }
    }),
    /**
     * List all indexing jobs
     * GET /api/clauses/jobs
     */
    listJobs: (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const jobs = clauseIndexer_1.clauseIndexer.listJobs();
            res.json({
                jobs: jobs.map(job => ({
                    jobId: job.id,
                    status: job.status,
                    progress: job.progress,
                    message: job.message
                }))
            });
        }
        catch (error) {
            console.error('❌ [clauseController] Error listing jobs:', error);
            res.status(500).json({
                error: 'Failed to list jobs',
                details: error.message
            });
        }
    })
};
