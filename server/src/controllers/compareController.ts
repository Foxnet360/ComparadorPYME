import { Request, Response } from 'express';
import { geminiService } from '../services/gemini';
import { pdfExtractor } from '../services/pdfExtractor';
import { quoteParser, ParsedQuote } from '../services/quoteParser';
import { detectFormatFamily, extractForDetection } from '../services/formatDetector';
import { buildPromptForFamily } from '../services/promptBuilder';
import { buildCanonicalCoverages } from '../services/coverageNormalizer';
import { extractPremiumBreakdown, extractPerCoveragePremiums, validatePremiumBreakdown, normalizeCurrency } from '../services/premiumExtractor';
import fs from 'fs';

/**
 * Compare V1 (legacy) vs V2 (multimodal) extraction
 * Endpoint: POST /api/compare-extraction
 */
export async function compareExtraction(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of files) {
      console.log(`🔍 Comparing extraction for: ${file.originalname}`);

      // V1: Legacy text extraction
      const v1Start = Date.now();
      let v1Result: ParsedQuote | null = null;
      let v1Error: string | null = null;

      try {
        const textResult = await pdfExtractor.extractTextFromPdf(file.path);
        v1Result = await quoteParser.parse(textResult.text);
      } catch (error: unknown) {
        v1Error = error instanceof Error ? error.message : 'Unknown error';
      }
      const v1Time = Date.now() - v1Start;

      // V2: Multimodal extraction
      const v2Start = Date.now();
      let v2Result: ParsedQuote | null = null;
      let v2Error: string | null = null;

      try {
        const quickText = extractForDetection(
          await pdfExtractor.extractTextFromPdf(file.path).then(r => r.text),
          2000
        );
        const formatResult = detectFormatFamily(quickText);
        const prompt = buildPromptForFamily(formatResult.family, {
          pageCount: formatResult.pageCount,
          hasTables: formatResult.hasTables,
        });

        const extracted = await geminiService.extractFromPdfWithVision(
          file.path,
          prompt,
          file.originalname
        );

        const normalizationResult = await buildCanonicalCoverages(
          extracted.rawCoverages || [],
          extracted.insuredAssets || [],
          extracted.generalDeductibles || []
        );

        const premiumBreakdown = extractPremiumBreakdown(extracted);
        const perCoveragePremiums = extractPerCoveragePremiums(extracted.rawCoverages || []);
        const premiumValidation = validatePremiumBreakdown(premiumBreakdown, perCoveragePremiums);

        v2Result = {
          insurerName: extracted.insurerName || 'NO ESPECIFICADO',
          policyName: extracted.policyName || 'NO ESPECIFICADO',
          priceAnnual: premiumBreakdown.totalPayable || 0,
          currency: normalizeCurrency(premiumBreakdown.currency),
          coverages: normalizationResult.canonicalCoverages.map(c => ({
            name: c.name,
            canonicalName: c.name,
            value: c.insuredAmount ? c.insuredAmount.toString() : 'NO ESPECIFICADO',
            deductible: c.deductible || 'NO ESPECIFICADO',
            confidence: c.confidence,
          })),
          validityPeriod: extracted.validityPeriod ?? undefined,
          specialConditions: [
            ...(extracted.specialConditions || []),
            ...(premiumValidation.warnings),
          ],
          rawText: JSON.stringify(extracted),
          parseConfidence: normalizationResult.totalConfidence,
          expectedCoverages: normalizationResult.canonicalCoverages.map(c => ({
            name: c.name,
            status: c.status,
            value: c.insuredAmount ? c.insuredAmount.toString() : null,
            deductible: c.deductible,
          })),
        };
      } catch (error: unknown) {
        v2Error = error instanceof Error ? error.message : 'Unknown error';
      }
      const v2Time = Date.now() - v2Start;

      // Compare results
      const comparison = {
        filename: file.originalname,
        v1: {
          success: !v1Error,
          error: v1Error,
          timeMs: v1Time,
          insurer: v1Result?.insurerName,
          coveragesCount: v1Result?.coverages?.length || 0,
          premium: v1Result?.priceAnnual,
          confidence: v1Result?.parseConfidence,
        },
        v2: {
          success: !v2Error,
          error: v2Error,
          timeMs: v2Time,
          insurer: v2Result?.insurerName,
          coveragesCount: v2Result?.coverages?.length || 0,
          premium: v2Result?.priceAnnual,
          confidence: v2Result?.parseConfidence,
        },
        improvements: {
          timeReduction: v1Time > 0 ? ((v1Time - v2Time) / v1Time * 100).toFixed(1) + '%' : 'N/A',
          coveragesDiff: (v2Result?.coverages?.length || 0) - (v1Result?.coverages?.length || 0),
          confidenceDiff: ((v2Result?.parseConfidence || 0) - (v1Result?.parseConfidence || 0)).toFixed(2),
        }
      };

      results.push(comparison);

      // Cleanup
      try {
        fs.unlinkSync(file.path);
      } catch (_e) {
        // Ignore cleanup errors
      }
    }

    // Summary
    const summary = {
      totalFiles: results.length,
      v1Success: results.filter(r => r.v1.success).length,
      v2Success: results.filter(r => r.v2.success).length,
      avgV1Time: Math.round(results.reduce((acc, r) => acc + r.v1.timeMs, 0) / results.length),
      avgV2Time: Math.round(results.reduce((acc, r) => acc + r.v2.timeMs, 0) / results.length),
      avgConfidenceV1: (results.reduce((acc, r) => acc + (r.v1.confidence || 0), 0) / results.length).toFixed(2),
      avgConfidenceV2: (results.reduce((acc, r) => acc + (r.v2.confidence || 0), 0) / results.length).toFixed(2),
    };

    res.json({
      success: true,
      summary,
      comparisons: results,
      recommendation: summary.v2Success >= summary.v1Success ? 'V2 recommended' : 'V1 more stable',
    });

  } catch (error: unknown) {
    console.error('Compare extraction error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
