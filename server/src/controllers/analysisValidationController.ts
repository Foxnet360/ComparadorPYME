/**
 * Analysis Validation Controller
 * Business logic for analysis validation endpoints
 * Extracted from routes/analysis.ts to separate routing from business logic
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { clauseCoverageValidator } from '../services/clauseCoverageValidator';
import { deductibleAnalyzer } from '../services/deductibleAnalyzer';
import { inverseCoverageChecker } from '../services/inverseCoverageChecker';
import { clauseVersionComparator } from '../services/clauseVersionComparator';
import { contextualRiskAnalyzer, ClientProfile } from '../services/contextualRiskAnalyzer';
import { warrantyComplianceAnalyzer } from '../services/warrantyComplianceAnalyzer';
import { virtualLawyerService } from '../services/virtualLawyerService';
import { structuredClauseExtractor } from '../services/structuredClauseExtractor';
import { variableComparator } from '../services/variableComparator';
import { learningEngine } from '../services/learningEngine';
import { supabase } from '../config/database';

export const validateCoverages = async (req: Request, res: Response): Promise<void> => {
  const { quote, insurerName } = req.body;

  if (!quote || !insurerName) {
    res.status(400).json({
      error: 'Missing required fields: quote, insurerName',
    });
    return;
  }

  const validation = await clauseCoverageValidator.validate(quote, insurerName);

  res.json(validation);
};

export const analyzeDeductibleRisk = async (req: Request, res: Response): Promise<void> => {
  const { coverageName, quoteDeductible, clauseDeductible, insuredAmount } = req.body;

  if (!coverageName || !quoteDeductible || !insuredAmount) {
    res.status(400).json({
      error: 'Missing required fields: coverageName, quoteDeductible, insuredAmount',
    });
    return;
  }

  const analysis = deductibleAnalyzer.analyze(
    coverageName,
    quoteDeductible,
    clauseDeductible || quoteDeductible,
    parseFloat(insuredAmount)
  );

  res.json(analysis);
};

export const checkInverseCoverages = async (req: Request, res: Response): Promise<void> => {
  const { quote, insurerName } = req.body;

  if (!quote || !insurerName) {
    res.status(400).json({
      error: 'Missing required fields: quote, insurerName',
    });
    return;
  }

  const result = await inverseCoverageChecker.checkMissingCoverages(quote, insurerName);
  res.json(result);
};

export const contextualizeExclusions = async (req: Request, res: Response): Promise<void> => {
  const { exclusions, clientProfile } = req.body;

  if (!exclusions || !Array.isArray(exclusions)) {
    res.status(400).json({
      error: 'Missing required field: exclusions (array)',
    });
    return;
  }

  const result = contextualRiskAnalyzer.contextualizeExclusions(
    exclusions,
    clientProfile as ClientProfile
  );

  res.json(result);
};

export const analyzeWarrantyCompliance = async (req: Request, res: Response): Promise<void> => {
  const { conditions, clientProfile } = req.body;

  if (!conditions || !Array.isArray(conditions)) {
    res.status(400).json({
      error: 'Missing required field: conditions (array)',
    });
    return;
  }

  const result = warrantyComplianceAnalyzer.analyzeConditions(conditions, clientProfile);

  res.json(result);
};

export const generateLegalOpinion = async (req: Request, res: Response): Promise<void> => {
  const { quote, clientProfile, insurerName } = req.body;

  if (!quote || !insurerName) {
    res.status(400).json({
      error: 'Missing required fields: quote, insurerName',
    });
    return;
  }

  const opinion = await virtualLawyerService.generateLegalOpinion(
    quote,
    clientProfile as ClientProfile,
    insurerName
  );

  res.json(opinion);
};

export const compareVersions = async (req: Request, res: Response): Promise<void> => {
  const { oldDocumentId, newDocumentId } = req.body;

  if (!oldDocumentId || !newDocumentId) {
    res.status(400).json({
      error: 'Missing required fields: oldDocumentId, newDocumentId',
    });
    return;
  }

  const result = await clauseVersionComparator.compareVersions(oldDocumentId, newDocumentId);
  res.json(result);
};

export const extractStructuredClause = async (req: Request, res: Response): Promise<void> => {
  const { clauseText, insurerName, productName, documentType } = req.body;

  if (!clauseText || !insurerName) {
    res.status(400).json({
      error: 'Missing required fields: clauseText, insurerName',
    });
    return;
  }

  const structured = await structuredClauseExtractor.extractFromText(
    clauseText,
    insurerName,
    productName,
    documentType || 'CLAUSULADO_GENERAL'
  );

  // Validate against raw text
  const validation = structuredClauseExtractor.validateExtraction(structured, clauseText);

  res.json({
    structured,
    validation,
  });
};

export const storeStructuredClause = async (req: Request, res: Response): Promise<void> => {
  const { structured, documentId } = req.body;

  if (!structured || !structured.insurer) {
    res.status(400).json({
      error: 'Missing required field: structured clause data',
    });
    return;
  }

  const id = await structuredClauseExtractor.storeStructuredClause(structured, documentId);

  res.json({ id, success: true });
};

export const compareVariables = async (req: Request, res: Response): Promise<void> => {
  const { quotes, weights } = req.body;

  if (!quotes || !Array.isArray(quotes) || quotes.length < 2) {
    res.status(400).json({
      error: 'Missing required field: quotes (array of at least 2 quotes)',
    });
    return;
  }

  const comparisons = await variableComparator.compareQuotes(quotes, weights);
  const matrix = variableComparator.generateComparisonMatrix(comparisons);

  res.json({
    comparisons,
    matrix,
    quoteCount: quotes.length,
  });
};

// Schema Zod para validación de correcciones
const CorrectionSchema = z.object({
  correctionId: z.string().optional(), // Para idempotencia
  rawName: z.string().min(1, 'rawName is required'),
  insurerName: z.string().min(1, 'insurerName is required'),
  systemMapping: z.string().min(1, 'systemMapping is required'),
  userCorrection: z.string().min(1, 'userCorrection is required'),
  correctionType: z
    .enum(['coverage_mapping', 'deductible', 'exclusion', 'value'])
    .default('coverage_mapping'),
  quoteId: z.string().optional(),
  rawTextSnippet: z.string().max(2000).optional(),
  aiJustification: z.string().max(2000).optional(),
  pageNumber: z.number().int().positive().optional(),
});

type CorrectionInput = z.infer<typeof CorrectionSchema>;

export const saveCorrection = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Validación con Zod
    const parseResult = CorrectionSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
      return;
    }

    const correction: CorrectionInput = parseResult.data;

    // 2. Idempotencia: verificar si ya existe una corrección con el mismo correctionId
    if (correction.correctionId) {
      const { data: existingCorrection, error: lookupError } = await supabase
        .from('coverage_mappings')
        .select('id')
        .eq('id', correction.correctionId)
        .single();

      if (!lookupError && existingCorrection) {
        res.json({
          id: (existingCorrection as Record<string, unknown>).id,
          success: true,
          cached: true,
        });
        return;
      }
    }

    // 3. Guardar corrección con campos extendidos
    const id = await learningEngine.saveCorrection({
      rawName: correction.rawName,
      insurerName: correction.insurerName,
      systemMapping: correction.systemMapping,
      userCorrection: correction.userCorrection,
      correctionType: correction.correctionType,
      quoteId: correction.quoteId,
      rawTextSnippet: correction.rawTextSnippet,
      aiJustification: correction.aiJustification,
      pageNumber: correction.pageNumber,
    });

    res.json({ id, success: true });
  } catch (error) {
    console.error('❌ [saveCorrection] Error:', error);
    res.status(500).json({
      error: 'Internal server error while saving correction',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * 1-Click disambiguation endpoint for uncertain coverage mappings (Phase 2)
 */
export const disambiguateCoverage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawName, insurerName, canonicalGroupId, action, domain } = req.body;

    if (!rawName || !action) {
      res.status(400).json({ error: 'rawName and action are required' });
      return;
    }

    if (action === 'confirm' || action === 'reassign') {
      const targetCanonical = canonicalGroupId;
      if (!targetCanonical) {
        res.status(400).json({ error: 'canonicalGroupId is required when action is confirm or reassign' });
        return;
      }

      // Save to learningEngine to update embeddings, thesaurus, and cache
      const correctionId = await learningEngine.saveCorrection({
        rawName,
        insurerName,
        systemMapping: 'AMBIGUOUS',
        userCorrection: targetCanonical,
        correctionType: 'coverage_mapping',
        domain: domain || 'pyme',
      });

      // Update coverage_mappings in Supabase to mark human review as satisfied
      try {
        await (supabase.from('coverage_mappings') as any)
          .upsert(
            {
              raw_name: rawName,
              insurer_name: insurerName || '',
              canonical_name: targetCanonical,
              confidence: 0.98,
              needs_human_review: false,
              user_corrected: true,
            },
            { onConflict: 'raw_name,insurer_name' }
          );
      } catch (dbErr) {
        console.warn('⚠️ [disambiguateCoverage] DB upsert warning:', dbErr);
      }

      res.json({
        success: true,
        action,
        rawName,
        resolvedGroupId: targetCanonical,
        correctionId,
      });
      return;
    }

    if (action === 'keep_autonomous') {
      try {
        await (supabase.from('coverage_mappings') as any)
          .upsert(
            {
              raw_name: rawName,
              insurer_name: insurerName || '',
              canonical_name: 'EXCLUSIVE',
              confidence: 0.2,
              needs_human_review: false,
              user_corrected: true,
            },
            { onConflict: 'raw_name,insurer_name' }
          );
      } catch (dbErr) {
        console.warn('⚠️ [disambiguateCoverage] DB upsert warning:', dbErr);
      }

      res.json({
        success: true,
        action: 'keep_autonomous',
        rawName,
        resolvedGroupId: 'EXCLUSIVE',
      });
      return;
    }

    res.status(400).json({ error: `Invalid action: ${action}` });
  } catch (error) {
    console.error('❌ [disambiguateCoverage] Error:', error);
    res.status(500).json({
      error: 'Internal server error while disambiguating coverage',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const getLearningMetrics = async (req: Request, res: Response): Promise<void> => {
  const metrics = await learningEngine.getMetrics();
  res.json(metrics);
};

export const getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  const report = await learningEngine.generateMonthlyReport();
  res.json(report);
};

export const batchRetrain = async (req: Request, res: Response): Promise<void> => {
  const result = await learningEngine.batchRetrainEmbeddings();
  res.json(result);
};

// NEW: Export dynamic Excel report unmapped horizontally
import { getAnalysisById } from '../repositories/analysisRepository';
import { generateExcelBuffer } from '../services/excelGenerator';

export const exportAnalysisExcel = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;

  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({ error: 'Missing required parameter: id' });
    return;
  }

  try {
    const analysis = await getAnalysisById(id);

    // Ownership check: when a userId is present and the analysis has an owner, enforce it.
    if (userId && analysis && analysis.user_id && analysis.user_id !== userId) {
      res.status(403).json({ error: 'Forbidden: analysis does not belong to current user' });
      return;
    }

    const quotes = analysis?.analysis_result?.quotes || req.body?.quotes || [];
    if (!quotes || quotes.length === 0) {
      res.status(404).json({ error: `Analysis with id ${id} not found and no quotes provided` });
      return;
    }

    const domain = (
      (req.query?.domain as string) ||
      req.body?.domain ||
      (analysis as any)?.domain ||
      ((analysis as any)?.analysis_result as any)?.domain ||
      ((analysis as any)?.metadata as any)?.domain ||
      'pyme'
    )
      .toLowerCase()
      .trim();

    const rawClientName =
      (req.query?.clientName as string) ||
      req.body?.clientName ||
      analysis?.client_name ||
      ((analysis as any)?.analysis_result as any)?.clientInfo?.name ||
      'Cliente';

    const defaultActivity =
      domain === 'copropiedades'
        ? 'Edificio Residencial / Comercial (Copropiedad)'
        : domain === 'autos'
          ? 'Vehículo Particular / Flotas'
          : domain === 'hogar'
            ? 'Vivienda Residencial / Hogar'
            : 'Comercial / PYME';

    const clientInfo = {
      name:
        rawClientName !== 'Edificio Alicante' || domain === 'copropiedades'
          ? rawClientName
          : 'Cliente',
      activity:
        (req.query?.clientActivity as string) ||
        req.body?.clientActivity ||
        ((analysis as any)?.analysis_result as any)?.clientInfo?.activity ||
        defaultActivity,
      location: 'Bogotá D.C.',
    };

    // Get cell notes and brokerInfo from request body or user session
    const cellNotes = req.body?.cellNotes as Record<string, string> | undefined;
    const brokerInfo = req.body?.brokerInfo || {
      name: req.user?.name,
      intermediaryName: req.user?.intermediaryName,
      registrationNumber: req.user?.registrationNumber,
      phone: req.user?.agentDetails?.phone,
      email: req.user?.email,
      address: req.user?.address || req.user?.agentDetails?.address,
      city: req.user?.city || req.user?.agentDetails?.city,
    };

    const reportData = {
      ...(typeof analysis?.analysis_result === 'object' && analysis?.analysis_result
        ? analysis.analysis_result
        : {}),
      ...(typeof req.body?.report === 'object' && req.body?.report ? req.body.report : {}),
      matrix:
        req.body?.matrix ||
        (analysis?.analysis_result as any)?.matrix ||
        (analysis?.analysis_result as any)?.rows,
    };
    const buffer = await generateExcelBuffer(
      quotes,
      clientInfo,
      cellNotes,
      brokerInfo,
      domain,
      reportData
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=comparativa_seguros_${id}.xlsx`);
    res.send(buffer);
  } catch (err: unknown) {
    console.error('❌ [exportAnalysisExcel] Error exporting to Excel:', err);
    res.status(500).json({
      error: 'Internal server error while exporting to Excel',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};
