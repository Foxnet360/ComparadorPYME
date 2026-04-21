import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { supabase } from '../config/database';
import { multiPhaseAnalyzer } from '../services/multiPhaseAnalyzer';
import fs from 'fs';
import path from 'path';

export const analysisController = {
    uploadAndAnalyze: async (req: Request, res: Response): Promise<void> => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const quoteFiles = files['quotes'] || [];
            const clauseFiles = files['clauses'] || [];

            // NEW: Support for clause IDs from library
            let clauseIds: string[] = [];
            if (req.body.clauseIds) {
                try {
                    clauseIds = JSON.parse(req.body.clauseIds);
                } catch {
                    clauseIds = [req.body.clauseIds]; // Single ID as string
                }
            }

            if (quoteFiles.length === 0) {
                res.status(400).json({ error: "No quote files uploaded" });
                return;
            }

            // 1. Extract text from quote PDFs
            const extractedQuotes = await pdfExtractor.processMultiplePdfs(
                quoteFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                'COTIZACIÓN'
            );
            const quotesText = pdfExtractor.combineExtractedTexts(extractedQuotes);

            // 2. Build clauses text
            let clausesText = '';

            // Extract from uploaded clause PDFs
            if (clauseFiles.length > 0) {
                const extractedClauses = await pdfExtractor.processMultiplePdfs(
                    clauseFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                    'CLAUSULADO_GENERAL'
                );
                clausesText = pdfExtractor.combineExtractedTexts(extractedClauses);
            }
            
            // Note: clauseIds from library feature removed - Firestore clauseLibrary deprecated
            // Future: Implement using Supabase document system if needed

            // 3. Cleanup temp files immediately after extraction
            [...quoteFiles, ...clauseFiles].forEach(f => {
                try {
                    fs.unlinkSync(f.path);
                } catch (e) {
                    console.error(`Failed to delete temp file ${f.path}`, e);
                }
            });

            // 3. Analizar usando pipeline multi-fase
            console.log('🚀 Iniciando análisis multi-fase...');
            const result = await multiPhaseAnalyzer.analyze(quotesText);

            // 4. Save to Supabase (replaces Firestore)
            const userId = req.body.userId || 'anonymous';
            const clientName = req.body.clientName || 'Cliente';

            // Save analysis to Supabase
            try {
                // Ensure score is an integer (round to nearest whole number)
                const rawScore = result.quotes?.[0]?.score;
                const totalScore = rawScore ? Math.round(rawScore) : null;
                
                const insertData = {
                    user_id: userId,
                    client_name: clientName,
                    analysis_result: result,
                    recommendation: result.recommendation || null,
                    total_score: totalScore
                };
                
                const { data, error } = await supabase
                    .from('analysis_history' as any)
                    .insert(insertData as any)
                    .select();

                if (error) {
                    console.error("❌ [Supabase] Failed to save analysis:", error);
                    console.error("   Error code:", error.code);
                    console.error("   Error message:", error.message);
                    console.error("   Error details:", error.details);
                }
            } catch (saveError: any) {
                console.error("❌ [Supabase] Exception saving analysis:", saveError);
                console.error("   Error stack:", saveError.stack);
            }
            
            console.log('✅ Análisis completado y guardado exitosamente');

            res.json(result);

        } catch (error: any) {
            console.error("Controller Error:", error);

            // Handle specific errors
            if (error.message?.includes("No response received")) {
                res.status(502).json({ error: "Upstream Error: No response from Gemini AI." });
                return;
            }
            if (error.message?.includes("429") || error.status === 429) {
                let msg = "Rate Limit Exceeded: Please try again later.";
                // Try to extract retry time
                const retryMatch = error.message?.match(/Please retry in ([0-9.]+)s/);
                if (retryMatch && retryMatch[1]) {
                    const seconds = Math.ceil(parseFloat(retryMatch[1]));
                    msg = `Rate Limit Exceeded: Please retry in ${seconds} seconds.`;
                }
                res.status(429).json({ error: msg });
                return;
            }

            res.status(500).json({
                error: "Internal Server Error during analysis",
                details: error.message || String(error),
                isMockData: false // Explicitly state this is NOT mock data
            });
        }

    },

    getHistory: async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.query.userId as string;
            if (!userId) {
                res.json([]);
                return;
            }

            // Fetch history from Supabase (replaces Firestore)
            const { data: history, error } = await supabase
                .from('analysis_history' as any)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching history from Supabase:", error);
                res.status(500).json({ error: "Failed to fetch history" });
                return;
            }

            res.json(history || []);
        } catch (error) {
            console.error("Error fetching history:", error);
            res.status(500).json({ error: "Failed to fetch history" });
        }
    }
};
