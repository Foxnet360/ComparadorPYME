import { Request, Response } from 'express';
import { pdfExtractor } from '../services/pdfExtractor';
import { semanticChunker, Chunk } from '../services/semanticChunker';
import { embeddingService } from '../services/vector/embeddingService';
import { vectorStore } from '../services/vectorStore';
import { ragRetrieval } from '../services/ragRetrieval';
import { groqService } from '../services/groqService';
import fs from 'fs';

interface IndexedClause {
    id: string;
    insurerName: string;
    documentName: string;
    indexedAt: Date;
    chunkCount: number;
}

const indexedClauses: Map<string, IndexedClause> = new Map();

export const ragClauseController = {
    /**
     * POST /api/rag/clauses - Upload and index a new clause document
     */
    indexClause: async (req: Request, res: Response): Promise<void> => {
        console.log('📥 [ragClauseController.indexClause] Request received');

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

            const validation = pdfExtractor.validatePdf(file.path);
            if (!validation.valid) {
                res.status(400).json({ error: validation.error });
                return;
            }

            console.log(`📄 [ragClauseController] Extracting text from ${file.originalname}`);
            const extractionResult = await pdfExtractor.extractTextFromPdf(file.path);

            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }

            console.log(`🔀 [ragClauseController] Creating semantic chunks`);
            const pages = extractionResult.text.split('\n\n');
            const pageBoundaries = semanticChunker.calculatePageBoundaries(pages);
            
            const chunks = semanticChunker.createChunks(
                extractionResult.text,
                {
                    documentName: file.originalname,
                    insurerName,
                },
                pageBoundaries
            );

            console.log(`🔢 [ragClauseController] Generating embeddings for ${chunks.length} chunks`);
            const chunksWithEmbeddings = await Promise.all(
                chunks.map(async (chunk: Chunk, index: number) => {
                    const embedding = await embeddingService.generateEmbedding(chunk.content);
                    return {
                        id: `${insurerName.toLowerCase().replace(/\s+/g, '_')}_${index}`,
                        content: chunk.content,
                        metadata: {
                            ...chunk.metadata,
                            insurerName,
                            documentName: file.originalname,
                            documentType: documentType || 'CLAUSULADO_GENERAL',
                        },
                        embedding,
                    };
                })
            );

            console.log(`💾 [ragClauseController] Storing in vector database`);
            await vectorStore.addChunks(insurerName, chunksWithEmbeddings);

            const clauseId = `${insurerName.toLowerCase()}_${Date.now()}`;
            indexedClauses.set(clauseId, {
                id: clauseId,
                insurerName,
                documentName: file.originalname,
                indexedAt: new Date(),
                chunkCount: chunks.length,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (e) {
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

        } catch (error: any) {
            console.error('Error indexing clause:', error);
            res.status(500).json({ error: error.message || 'Failed to index clause' });
        }
    },

    /**
     * GET /api/rag/clauses - List indexed clause documents
     */
    listClauses: async (req: Request, res: Response): Promise<void> => {
        try {
            const insurerName = req.query.insurer as string | undefined;
            
            const documents = await vectorStore.listDocuments(insurerName);
            
            const clauses = documents.map(doc => ({
                insurerName: doc.insurerName,
                documentName: doc.documentName,
                chunkCount: doc.chunkCount,
            }));

            res.json(clauses);
        } catch (error: any) {
            console.error('Error listing clauses:', error);
            res.status(500).json({ error: error.message || 'Failed to list clauses' });
        }
    },

    /**
     * DELETE /api/rag/clauses - Delete indexed clause
     */
    deleteClause: async (req: Request, res: Response): Promise<void> => {
        try {
            const { insurerName, documentName } = req.body;

            if (!insurerName || !documentName) {
                res.status(400).json({ error: 'Missing insurerName or documentName' });
                return;
            }

            await vectorStore.deleteDocument(insurerName, documentName);

            res.status(200).json({ success: true, message: 'Clause deleted' });
        } catch (error: any) {
            console.error('Error deleting clause:', error);
            res.status(500).json({ error: error.message || 'Failed to delete clause' });
        }
    },

    /**
     * POST /api/rag/clauses/:id/reindex - Re-index an existing clause document
     */
    reindexClause: async (req: Request, res: Response): Promise<void> => {
        console.log('📥 [ragClauseController.reindexClause] Request received');

        try {
            const id = String(req.params.id);
            const file = req.file;
            const { insurerName, documentName, documentType } = req.body;

            if (!file) {
                res.status(400).json({ error: 'No file uploaded for re-indexing' });
                return;
            }

            const targetInsurerName = insurerName || indexedClauses.get(id)?.insurerName;
            const targetDocumentName = documentName || indexedClauses.get(id)?.documentName;

            if (!targetInsurerName || !targetDocumentName) {
                res.status(400).json({ error: 'Missing insurerName or documentName' });
                return;
            }

            console.log(`🗑️ [ragClauseController] Deleting existing chunks for ${targetDocumentName}`);
            await vectorStore.deleteDocument(targetInsurerName, targetDocumentName);

            console.log(`📄 [ragClauseController] Extracting text from ${file.originalname}`);
            const extractionResult = await pdfExtractor.extractTextFromPdf(file.path);

            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }

            console.log(`🔀 [ragClauseController] Creating semantic chunks`);
            const pages = extractionResult.text.split('\n\n');
            const pageBoundaries = semanticChunker.calculatePageBoundaries(pages);
            
            const chunks = semanticChunker.createChunks(
                extractionResult.text,
                {
                    documentName: file.originalname,
                    insurerName: targetInsurerName,
                },
                pageBoundaries
            );

            console.log(`🔢 [ragClauseController] Generating embeddings for ${chunks.length} chunks`);
            const chunksWithEmbeddings = await Promise.all(
                chunks.map(async (chunk: Chunk, index: number) => {
                    const embedding = await embeddingService.generateEmbedding(chunk.content);
                    return {
                        id: `${targetInsurerName.toLowerCase().replace(/\s+/g, '_')}_${index}`,
                        content: chunk.content,
                        metadata: {
                            ...chunk.metadata,
                            insurerName: targetInsurerName,
                            documentName: file.originalname,
                            documentType: documentType || 'CLAUSULADO_GENERAL',
                        },
                        embedding,
                    };
                })
            );

            console.log(`💾 [ragClauseController] Storing new chunks in vector database`);
            await vectorStore.addChunks(targetInsurerName, chunksWithEmbeddings);

            indexedClauses.set(id, {
                id,
                insurerName: targetInsurerName,
                documentName: file.originalname,
                indexedAt: new Date(),
                chunkCount: chunks.length,
            });

            try {
                fs.unlinkSync(file.path);
            } catch (e) {
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

        } catch (error: any) {
            console.error('Error re-indexing clause:', error);
            res.status(500).json({ error: error.message || 'Failed to re-index clause' });
        }
    },

    /**
     * POST /api/rag/analyze - Analyze a quote with RAG
     */
    analyzeQuote: async (req: Request, res: Response): Promise<void> => {
        console.log('📥 [ragClauseController.analyzeQuote] Request received');

        try {
            const file = req.file;
            const { insurerName, coverageTerms } = req.body;

            if (!file) {
                res.status(400).json({ error: 'No file uploaded' });
                return;
            }

            console.log(`📄 [ragClauseController] Extracting quote text`);
            const extractionResult = await pdfExtractor.extractTextFromPdf(file.path);

            if (extractionResult.text.length === 0) {
                res.status(400).json({ error: 'PDF contains no extractable text' });
                return;
            }

            const terms = coverageTerms 
                ? JSON.parse(coverageTerms as string)
                : ['cobertura', 'exclusiones', 'deducibles', 'límites', 'condiciones'];

            console.log(`🔍 [ragClauseController] Retrieving relevant chunks`);
            const retrievalResult = await ragRetrieval.retrieveWithTerms(terms, insurerName, 3);

            console.log(`🤖 [ragClauseController] Analyzing with Groq`);
            const analysisResult = await groqService.analyzeQuote(
                extractionResult.text,
                {
                    chunks: retrievalResult.chunks.map(c => c.content),
                    citations: retrievalResult.citations,
                }
            );

            analysisResult.citations = ragRetrieval.buildCitations(retrievalResult.chunks);

            try {
                fs.unlinkSync(file.path);
            } catch (e) {
                console.error('Failed to delete temp file', e);
            }

            res.json({
                quote: analysisResult,
                retrievalStats: {
                    chunksRetrieved: retrievalResult.chunks.length,
                    termsUsed: terms,
                },
            });

        } catch (error: any) {
            console.error('Error analyzing quote:', error);
            res.status(500).json({ error: error.message || 'Failed to analyze quote' });
        }
    },

    /**
     * POST /api/rag/search - Search clauses
     */
    search: async (req: Request, res: Response): Promise<void> => {
        try {
            const { query, insurerName, limit } = req.body;

            if (!query) {
                res.status(400).json({ error: 'Missing query' });
                return;
            }

            const results = await ragRetrieval.retrieve(
                query,
                insurerName,
                limit || 5
            );

            res.json({
                query,
                results: results.chunks.map(chunk => ({
                    id: chunk.id,
                    content: chunk.content.substring(0, 500),
                    metadata: chunk.metadata,
                    distance: chunk.distance,
                })),
            });
        } catch (error: any) {
            console.error('Error searching:', error);
            res.status(500).json({ error: error.message || 'Failed to search' });
        }
    },
};
