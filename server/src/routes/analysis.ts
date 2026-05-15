/**
 * Analysis Validation Routes
 * New endpoints for clause coverage validation and risk analysis
 */

import { Router } from 'express';
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

const router = Router();

/**
 * POST /api/analysis/validate-coverages
 * Validate coverages bidirectionally (quote ↔ clause)
 */
router.post('/validate-coverages', async (req, res) => {
  try {
    const { quote, insurerName } = req.body;
    
    if (!quote || !insurerName) {
      res.status(400).json({ 
        error: 'Missing required fields: quote, insurerName' 
      });
      return;
    }
    
    const validation = await clauseCoverageValidator.validate(quote, insurerName);
    
    res.json(validation);
  } catch (error: any) {
    console.error('❌ [analysis/validate-coverages] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/deductible-risk
 * Analyze deductible risk considering insured amount
 */
router.post('/deductible-risk', async (req, res) => {
  try {
    const { coverageName, quoteDeductible, clauseDeductible, insuredAmount } = req.body;
    
    if (!coverageName || !quoteDeductible || !insuredAmount) {
      res.status(400).json({ 
        error: 'Missing required fields: coverageName, quoteDeductible, insuredAmount' 
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
  } catch (error: any) {
    console.error('❌ [analysis/deductible-risk] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/inverse-check
 * Check for missing coverages from clause document
 */
router.post('/inverse-check', async (req, res) => {
  try {
    const { quote, insurerName } = req.body;
    
    if (!quote || !insurerName) {
      res.status(400).json({ 
        error: 'Missing required fields: quote, insurerName' 
      });
      return;
    }
    
    const result = await inverseCoverageChecker.checkMissingCoverages(quote, insurerName);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [analysis/inverse-check] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/contextualize
 * Contextualize exclusions based on client profile
 */
router.post('/contextualize', async (req, res) => {
  try {
    const { exclusions, clientProfile } = req.body;
    
    if (!exclusions || !Array.isArray(exclusions)) {
      res.status(400).json({ 
        error: 'Missing required field: exclusions (array)' 
      });
      return;
    }
    
    const result = contextualRiskAnalyzer.contextualizeExclusions(
      exclusions,
      clientProfile as ClientProfile
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ [analysis/contextualize] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/warranty-compliance
 * Analyze warranty compliance conditions
 */
router.post('/warranty-compliance', async (req, res) => {
  try {
    const { conditions, clientProfile } = req.body;
    
    if (!conditions || !Array.isArray(conditions)) {
      res.status(400).json({ 
        error: 'Missing required field: conditions (array)' 
      });
      return;
    }
    
    const result = warrantyComplianceAnalyzer.analyzeConditions(
      conditions,
      clientProfile
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ [analysis/warranty-compliance] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/legal-opinion
 * Generate legal opinion with RAG
 */
router.post('/legal-opinion', async (req, res) => {
  try {
    const { quote, clientProfile, insurerName } = req.body;
    
    if (!quote || !insurerName) {
      res.status(400).json({ 
        error: 'Missing required fields: quote, insurerName' 
      });
      return;
    }
    
    const opinion = await virtualLawyerService.generateLegalOpinion(
      quote,
      clientProfile as ClientProfile,
      insurerName
    );
    
    res.json(opinion);
  } catch (error: any) {
    console.error('❌ [analysis/legal-opinion] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/compare-versions
 * Compare two versions of a clause document
 */
router.post('/compare-versions', async (req, res) => {
  try {
    const { oldDocumentId, newDocumentId } = req.body;
    
    if (!oldDocumentId || !newDocumentId) {
      res.status(400).json({ 
        error: 'Missing required fields: oldDocumentId, newDocumentId' 
      });
      return;
    }
    
    const result = await clauseVersionComparator.compareVersions(oldDocumentId, newDocumentId);
    res.json(result);
  } catch (error: any) {
    console.error('❌ [analysis/compare-versions] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/extract-structured-clause
 * Extract structured data from clause text
 */
router.post('/extract-structured-clause', async (req, res) => {
  try {
    const { clauseText, insurerName, productName, documentType } = req.body;
    
    if (!clauseText || !insurerName) {
      res.status(400).json({ 
        error: 'Missing required fields: clauseText, insurerName' 
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
      validation
    });
  } catch (error: any) {
    console.error('❌ [analysis/extract-structured-clause] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/store-structured-clause
 * Store structured clause in database
 */
router.post('/store-structured-clause', async (req, res) => {
  try {
    const { structured, documentId } = req.body;
    
    if (!structured || !structured.insurer) {
      res.status(400).json({ 
        error: 'Missing required field: structured clause data' 
      });
      return;
    }
    
    const id = await structuredClauseExtractor.storeStructuredClause(structured, documentId);
    
    res.json({ id, success: true });
  } catch (error: any) {
    console.error('❌ [analysis/store-structured-clause] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/compare-variables
 * Compare quotes variable by variable
 */
router.post('/compare-variables', async (req, res) => {
  try {
    const { quotes, weights } = req.body;
    
    if (!quotes || !Array.isArray(quotes) || quotes.length < 2) {
      res.status(400).json({ 
        error: 'Missing required field: quotes (array of at least 2 quotes)' 
      });
      return;
    }
    
    const comparisons = await variableComparator.compareQuotes(quotes, weights);
    const matrix = variableComparator.generateComparisonMatrix(comparisons);
    
    res.json({
      comparisons,
      matrix,
      quoteCount: quotes.length
    });
  } catch (error: any) {
    console.error('❌ [analysis/compare-variables] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/correction
 * Save user correction for learning
 */
router.post('/correction', async (req, res) => {
  try {
    const { rawName, insurerName, systemMapping, userCorrection, correctionType, quoteId } = req.body;
    
    if (!rawName || !userCorrection) {
      res.status(400).json({ 
        error: 'Missing required fields: rawName, userCorrection' 
      });
      return;
    }
    
    const id = await learningEngine.saveCorrection({
      rawName,
      insurerName,
      systemMapping,
      userCorrection,
      correctionType: correctionType || 'coverage_mapping',
      quoteId
    });
    
    res.json({ id, success: true });
  } catch (error: any) {
    console.error('❌ [analysis/correction] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/analysis/learning-metrics
 * Get learning engine metrics
 */
router.get('/learning-metrics', async (req, res) => {
  try {
    const metrics = await learningEngine.getMetrics();
    
    res.json(metrics);
  } catch (error: any) {
    console.error('❌ [analysis/learning-metrics] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * GET /api/analysis/monthly-report
 * Get monthly learning report
 */
router.get('/monthly-report', async (req, res) => {
  try {
    const report = await learningEngine.generateMonthlyReport();
    
    res.json(report);
  } catch (error: any) {
    console.error('❌ [analysis/monthly-report] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * POST /api/analysis/batch-retrain
 * Trigger batch embedding retraining
 */
router.post('/batch-retrain', async (req, res) => {
  try {
    const result = await learningEngine.batchRetrainEmbeddings();
    
    res.json(result);
  } catch (error: any) {
    console.error('❌ [analysis/batch-retrain] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

export default router;
