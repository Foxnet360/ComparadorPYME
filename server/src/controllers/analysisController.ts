import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { clauseLibrary } from '../services/clauseLibrary';
import { ANALYSIS_SCHEMA } from '../constants/schemas';
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

            console.log(`📥 Received ${quoteFiles.length} quotes, ${clauseFiles.length} clause files, ${clauseIds.length} clause IDs`);

            // 1. Extract text from quote PDFs
            console.log("📄 Extracting text from quote PDFs...");
            const extractedQuotes = await pdfExtractor.processMultiplePdfs(
                quoteFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                'COTIZACIÓN'
            );
            const quotesText = pdfExtractor.combineExtractedTexts(extractedQuotes);
            console.log(`✅ Extracted: ${quotesText.length} chars from quotes`);

            // 2. Build clauses text
            let clausesText = '';

            // Priority: clauseIds from library (optimized) > uploaded files (legacy)
            if (clauseIds.length > 0) {
                // Fetch clauses from library
                console.log(`📚 Fetching ${clauseIds.length} clauses from library...`);
                const libraryClauses = await Promise.all(
                    clauseIds.map(id => clauseLibrary.getClauseById(id))
                );
                const validClauses = libraryClauses.filter(c => c !== null);
                console.log(`✅ Fetched ${validClauses.length} clauses from library`);

                // Build optimized text using sections
                clausesText = geminiService.buildSectionText(validClauses as any);
                console.log(`📊 Clauses text (sections): ${clausesText.length} chars`);
            } else if (clauseFiles.length > 0) {
                // Legacy: Extract from uploaded PDFs
                console.log("📄 Extracting clauses from uploaded PDFs (legacy mode)...");
                const extractedClauses = await pdfExtractor.processMultiplePdfs(
                    clauseFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                    'CLAUSULADO'
                );
                clausesText = pdfExtractor.combineExtractedTexts(extractedClauses);
                console.log(`📊 Clauses text (full): ${clausesText.length} chars`);
            }

            // 3. Cleanup temp files immediately after extraction
            [...quoteFiles, ...clauseFiles].forEach(f => {
                try {
                    fs.unlinkSync(f.path);
                } catch (e) {
                    console.error(`Failed to delete temp file ${f.path}`, e);
                }
            });

            // 3. Analyze with extracted text (NOT File API)
            const prompt = `
        **CONTEXTO**: Eres un experto actuario y analista de seguros corporativos.
        
        **NOTA IMPORTANTE**: El contenido a continuación es TEXTO EXTRAÍDO de documentos PDF. 
        Los marcadores === INICIO/FIN === delimitan cada documento.
        
        REALIZA EL ANÁLISIS SIGUIENDO ESTA LÓGICA DE PRIORIDAD DE FUENTES:
      
        1. **COTIZACIONES (Prioridad 1):** Extrae: Primas, Aseguradora, Valores Asegurados, Deducibles explícitos y condiciones particulares.
        
        2. **CLAUSULADOS (Prioridad 2 - "Base de Conocimiento"):** 
           - ÚSALOS para verificar las "letras chicas", garantías, exclusiones generales.
           - Si la cotización menciona "Según clausulado X", cruza la información.
        
        **TAREAS OBLIGATORIAS:**
        - Mapea las coberturas usando EXACTAMENTE los nombres de la Plantilla PYME.
        - Calcula el 'scoringBreakdown' basándote en la dureza de los deducibles y clausulados encontrados.
        `;

            const result = await geminiService.analyzeQuotesFromText(quotesText, clausesText, prompt, ANALYSIS_SCHEMA);

            // DEBUG: Log result structure
            console.log('📊 [DEBUG] Gemini result received');
            console.log('   - typeof result:', typeof result);
            console.log('   - result.quotes:', result?.quotes ? `Array[${result.quotes.length}]` : 'UNDEFINED');
            if (result?.quotes?.length > 0) {
                console.log('   - First quote:', JSON.stringify(result.quotes[0]).substring(0, 200) + '...');
            }

            // 4. Save to Firestore (Async/Background or Await based on preference)
            // We await to ensure we return success only if saved, or we can make it background.
            // Given "cloud run" and potential instance termination, best to await or use Cloud Tasks (out of scope).
            // We will await for now.
            const userId = req.body.userId || 'anonymous';
            const clientName = req.body.clientName || 'Cliente';

            // Validate result structure before saving (optional but safe)
            try {
                // Import firestoreService dynamically if needed or at top. 
                // We'll use the imported one.
                const { firestoreService } = require('../services/firestore');
                await firestoreService.saveAnalysis(userId, clientName, result);
            } catch (saveError) {
                console.error("Failed to save to Firestore:", saveError);
                // We don't block response, just log.
            }

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

            // Lazy load service
            const { firestoreService } = require('../services/firestore');
            const history = await firestoreService.getHistoryByUser(userId);
            res.json(history);
        } catch (error) {
            console.error("Error fetching history:", error);
            res.status(500).json({ error: "Failed to fetch history" });
        }
    }
};
