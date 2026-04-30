import { Request, Response } from 'express';
import { clauseIndexer } from '../services/clauseIndexer';

export const clauseController = {
    /**
     * Start async indexing of a clause document
     * POST /api/clauses/index
     */
    indexClause: async (req: Request, res: Response): Promise<void> => {
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

            const jobId = await clauseIndexer.startIndexing(file.path, {
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

        } catch (error: any) {
            console.error('❌ [clauseController] Error starting indexing:', error);
            res.status(500).json({
                error: 'Failed to start clause indexing',
                details: error.message
            });
        }
    },

    /**
     * Get indexing job status
     * GET /api/clauses/status/:jobId
     */
    getJobStatus: async (req: Request, res: Response): Promise<void> => {
        try {
            const jobId = req.params.jobId as string;
            const job = clauseIndexer.getJobStatus(jobId);

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

        } catch (error: any) {
            console.error('❌ [clauseController] Error getting job status:', error);
            res.status(500).json({
                error: 'Failed to get job status',
                details: error.message
            });
        }
    },

    /**
     * List all indexing jobs
     * GET /api/clauses/jobs
     */
    listJobs: async (_req: Request, res: Response): Promise<void> => {
        try {
            const jobs = clauseIndexer.listJobs();
            
            res.json({
                jobs: jobs.map(job => ({
                    jobId: job.id,
                    status: job.status,
                    progress: job.progress,
                    message: job.message
                }))
            });

        } catch (error: any) {
            console.error('❌ [clauseController] Error listing jobs:', error);
            res.status(500).json({
                error: 'Failed to list jobs',
                details: error.message
            });
        }
    }
};