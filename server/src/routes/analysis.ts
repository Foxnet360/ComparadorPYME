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
    const { quoteId, coverageNames, clientProfile } = req.body;
    
    if (!quoteId || !coverageNames) {
      res.status(400).json({ 
        error: 'Missing required fields: quoteId, coverageNames' 
      });
      return;
    }
    
    // TODO: Implement legal opinion when virtualLawyerService is ready
    res.json({ 
      status: 'not_implemented',
      message: 'Legal opinion generation coming in Phase 4'
    });
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

export default router;
