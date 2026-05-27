/**
 * Analysis Validation Controller
 * Business logic for analysis validation endpoints
 * Extracted from routes/analysis.ts to separate routing from business logic
 */

import { Request, Response } from 'express';
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

export const validateCoverages = async (req: Request, res: Response): Promise<void> => {
  const { quote, insurerName } = req.body;
  
  if (!quote || !insurerName) {
    res.status(400).json({ 
      error: 'Missing required fields: quote, insurerName' 
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
};

export const checkInverseCoverages = async (req: Request, res: Response): Promise<void> => {
  const { quote, insurerName } = req.body;
  
  if (!quote || !insurerName) {
    res.status(400).json({ 
      error: 'Missing required fields: quote, insurerName' 
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
      error: 'Missing required field: exclusions (array)' 
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
      error: 'Missing required field: conditions (array)' 
    });
    return;
  }
  
  const result = warrantyComplianceAnalyzer.analyzeConditions(
    conditions,
    clientProfile
  );
  
  res.json(result);
};

export const generateLegalOpinion = async (req: Request, res: Response): Promise<void> => {
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
};

export const compareVersions = async (req: Request, res: Response): Promise<void> => {
  const { oldDocumentId, newDocumentId } = req.body;
  
  if (!oldDocumentId || !newDocumentId) {
    res.status(400).json({ 
      error: 'Missing required fields: oldDocumentId, newDocumentId' 
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
};

export const storeStructuredClause = async (req: Request, res: Response): Promise<void> => {
  const { structured, documentId } = req.body;
  
  if (!structured || !structured.insurer) {
    res.status(400).json({ 
      error: 'Missing required field: structured clause data' 
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
};

export const saveCorrection = async (req: Request, res: Response): Promise<void> => {
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

export const exportAnalysisExcel = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id as string;
  
  if (!id) {
    res.status(400).json({ error: 'Missing required parameter: id' });
    return;
  }
  
  try {
    const analysis = await getAnalysisById(id);
    if (!analysis) {
      res.status(404).json({ error: `Analysis with id ${id} not found` });
      return;
    }
    
    const quotes = analysis.analysis_result?.quotes || [];
    if (quotes.length === 0) {
      res.status(404).json({ error: `No quotes found in analysis ${id}` });
      return;
    }
    
    const clientInfo = {
      name: analysis.client_name || 'Cliente',
      activity: 'Centro de Belleza y/o Estetica (CIIU 9602)',
      location: 'Bogotá D.C.'
    };
    
    const buffer = await generateExcelBuffer(quotes, clientInfo);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=comparativa_seguros_${id}.xlsx`);
    res.send(buffer);
  } catch (err: any) {
    console.error('❌ [exportAnalysisExcel] Error exporting to Excel:', err);
    res.status(500).json({ error: 'Internal server error while exporting to Excel', details: err.message });
  }
};
