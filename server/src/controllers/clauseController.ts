import { Request, Response } from 'express';
import { clauseLibrary } from '../services/clauseLibrary';
import fs from 'fs';

export const clauseController = {
    /**
     * POST /api/clauses - Upload a new clause document
     */
    createClause: async (req: Request, res: Response): Promise<void> => {
        console.log('📥 [clauseController.createClause] Request received');
        console.log('   - Body:', req.body);
        console.log('   - File:', req.file ? req.file.originalname : 'NO FILE');

        try {
            const file = req.file;
            if (!file) {
                console.log('❌ No file uploaded');
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            const { aseguradora, producto, version } = req.body;
            if (!aseguradora || !producto || !version) {
                console.log('❌ Missing fields:', { aseguradora, producto, version });
                res.status(400).json({ error: 'Missing required fields: aseguradora, producto, version' });
                return;
            }

            const clause = await clauseLibrary.createClause(
                file.path,
                file.originalname,
                { aseguradora, producto, version }
            );

            // Cleanup temp file
            try {
                fs.unlinkSync(file.path);
            } catch (e) {
                console.error('Failed to delete temp file', e);
            }

            res.status(201).json(clause);
        } catch (error: any) {
            console.error('Error creating clause:', error);
            res.status(500).json({ error: error.message || 'Failed to create clause' });
        }
    },

    /**
     * GET /api/clauses - List all clauses (with optional insurer filter)
     */
    getClauses: async (req: Request, res: Response): Promise<void> => {
        try {
            const aseguradora = req.query.aseguradora as string | undefined;
            const clauses = await clauseLibrary.getAllClauses(aseguradora);

            // Return without textoCompleto to reduce payload size
            const summary = clauses.map(c => ({
                id: c.id,
                aseguradora: c.aseguradora,
                producto: c.producto,
                version: c.version,
                tokensEstimados: c.tokensEstimados,
                tieneSecciones: !!(c.secciones?.exclusiones || c.secciones?.deducibles || c.secciones?.garantias),
                fechaActualizacion: c.fechaActualizacion
            }));

            res.json(summary);
        } catch (error: any) {
            console.error('Error getting clauses:', error);
            res.status(500).json({ error: error.message || 'Failed to get clauses' });
        }
    },

    /**
     * GET /api/clauses/:id - Get a specific clause by ID
     */
    getClauseById: async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const clause = await clauseLibrary.getClauseById(id);

            if (!clause) {
                res.status(404).json({ error: 'Clause not found' });
                return;
            }

            res.json(clause);
        } catch (error: any) {
            console.error('Error getting clause:', error);
            res.status(500).json({ error: error.message || 'Failed to get clause' });
        }
    },

    /**
     * GET /api/insurers - List all insurers with clause counts
     */
    getInsurers: async (_req: Request, res: Response): Promise<void> => {
        try {
            const insurers = await clauseLibrary.listInsurers();
            res.json(insurers);
        } catch (error: any) {
            console.error('Error getting insurers:', error);
            res.status(500).json({ error: error.message || 'Failed to get insurers' });
        }
    },

    /**
     * DELETE /api/clauses/:id - Deactivate a clause
     */
    deleteClause: async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            await clauseLibrary.deactivateClause(id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting clause:', error);
            res.status(500).json({ error: error.message || 'Failed to delete clause' });
        }
    },

    /**
     * POST /api/clauses/:id/extract - Re-extract sections for a clause
     */
    reExtractSections: async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const secciones = await clauseLibrary.reExtractSections(id);
            res.json({ success: true, secciones });
        } catch (error: any) {
            console.error('Error extracting sections:', error);
            res.status(500).json({ error: error.message || 'Failed to extract sections' });
        }
    }
};
