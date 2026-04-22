import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { quoteParser, ParsedQuote } from '../services/quoteParser';
import { supabase } from '../config/database';
import fs from 'fs';

const EXTRACTION_PROMPT = `Eres un extractor de datos de cotizaciones de seguros PYME.

TAREA: Extrae los siguientes datos del texto de la cotización y presentalos 
en formato estructurado usando los marcadores ===.

=== INICIO EXTRACCIÓN ===

ASEGURADORA: [nombre exacto de la aseguradora]
PÓLIZA: [nombre del producto]
PRIMA ANUAL: [valor numérico]
MONEDA: [COP/USD]
VIGENCIA: [fecha inicio - fecha fin]

COBERTURAS:
- [Nombre cobertura]: [Valor asegurado o descripción]
  Deducible: [X% o valor o "No aplica"]
- [Siguiente cobertura]...

CONDICIONES ESPECIALES:
- [Cualquier condición particular mencionada]

=== FIN EXTRACCIÓN ===

REGLAS:
1. Si una cobertura no está especificada, pon "NO ESPECIFICADO"
2. Mantén los nombres exactos como aparecen en el documento
3. Extrae TODAS las coberturas que encuentres, sin omitir ninguna
4. Sé preciso con los valores numéricos y porcentajes`;

export const analysisController = {
    uploadAndAnalyze: async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            const quoteFiles = files['quotes'] || [];

            if (quoteFiles.length === 0) {
                res.status(400).json({ error: "No quote files uploaded" });
                return;
            }

            console.log(`📄 Processing ${quoteFiles.length} quotes...`);

            // 1. Extract text from quote PDFs
            const extractedQuotes = await pdfExtractor.processMultiplePdfs(
                quoteFiles.map(f => ({ path: f.path, originalname: f.originalname })),
                'COTIZACIÓN'
            );

            // 2. Process each quote individually with Gemini
            const parsedQuotes: ParsedQuote[] = [];
            
            for (let i = 0; i < extractedQuotes.length; i++) {
                const quote = extractedQuotes[i];
                console.log(`🔍 Analyzing quote ${i + 1}/${extractedQuotes.length}: ${quote.filename}`);
                
                try {
                    // Send to Gemini for text extraction
                    const geminiResponse = await geminiService.extractText(
                        quote.text,
                        EXTRACTION_PROMPT
                    );
                    
                    // Parse the response
                    const parsed = quoteParser.parse(geminiResponse);
                    parsedQuotes.push(parsed);
                    
                    console.log(`✅ Parsed quote ${i + 1}: ${parsed.insurerName}, ${parsed.coverages.length} coverages`);
                } catch (error) {
                    console.error(`❌ Error processing quote ${i + 1}:`, error);
                    // Add placeholder with error info
                    parsedQuotes.push({
                        insurerName: quote.filename || 'Unknown',
                        policyName: 'Error en procesamiento',
                        priceAnnual: 0,
                        currency: 'COP',
                        coverages: [],
                        specialConditions: [`Error: ${(error as Error).message}`],
                        rawText: quote.text.substring(0, 500),
                        parseConfidence: 0
                    });
                }
            }

            // 3. Cleanup temp files
            quoteFiles.forEach(f => {
                try {
                    fs.unlinkSync(f.path);
                } catch (e) {
                    console.error(`Failed to delete temp file ${f.path}`, e);
                }
            });

            // 4. Generate basic comparison data
            const comparisonResult = generateComparison(parsedQuotes);

            // 5. Save to Supabase
            const userId = req.body.userId || 'anonymous';
            const clientName = req.body.clientName || 'Cliente';

            try {
                const insertData = {
                    user_id: userId,
                    client_name: clientName,
                    analysis_result: comparisonResult,
                    recommendation: comparisonResult.recommendation || null,
                    total_score: comparisonResult.quotes?.[0]?.score || null
                };
                
                const { error } = await supabase
                    .from('analysis_history' as any)
                    .insert(insertData as any)
                    .select();

                if (error) {
                    console.error("❌ [Supabase] Failed to save analysis:", error);
                }
            } catch (saveError: any) {
                console.error("❌ [Supabase] Exception saving analysis:", saveError);
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ Analysis completed in ${duration}ms`);

            res.json(comparisonResult);

        } catch (error: any) {
            console.error("Controller Error:", error);

            if (error.message?.includes("No response received")) {
                res.status(502).json({ error: "Upstream Error: No response from Gemini AI." });
                return;
            }
            if (error.message?.includes("429") || error.status === 429) {
                res.status(429).json({ error: "Rate Limit Exceeded: Please try again later." });
                return;
            }

            res.status(500).json({
                error: "Internal Server Error during analysis",
                details: error.message || String(error),
                isMockData: false
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

function generateComparison(quotes: ParsedQuote[]) {
    // Calculate basic scores
    const quotesWithScores = quotes.map(quote => {
        const coverageScore = quote.coverages.length > 0 
            ? Math.min(10, quote.coverages.length / 14 * 10) 
            : 0;
        
        return {
            insurerName: quote.insurerName,
            policyName: quote.policyName,
            priceAnnual: quote.priceAnnual,
            currency: quote.currency,
            coverages: quote.coverages.map(c => ({
                name: c.canonicalName || c.name,
                value: c.value,
                deductible: c.deductible
            })),
            score: Math.round(coverageScore * 10),
            parseConfidence: quote.parseConfidence,
            specialConditions: quote.specialConditions
        };
    });

    // Sort by score (descending)
    quotesWithScores.sort((a, b) => b.score - a.score);

    return {
        quotes: quotesWithScores,
        recommendation: quotes.length > 0 
            ? `Mejor opción: ${quotesWithScores[0].insurerName} con score de ${quotesWithScores[0].score}/100`
            : 'No se pudieron analizar las cotizaciones',
        marketAnalysis: `Se analizaron ${quotes.length} cotizaciones.`,
        timestamp: new Date().toISOString()
    };
}