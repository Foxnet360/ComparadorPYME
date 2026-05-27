/**
 * Deductible Analyzer
 * Analyzes deductible risk considering insured amount, caps, and proportions
 * Uses the new semantic deductible parser for compound structures
 */

import { deductibleParser } from './deductibleParser';
import { deductibleBenchmarks } from './deductibleBenchmarks';

export interface DeductibleAnalysis {
  coverageName: string;
  quoteDeductible: string;
  clauseDeductible: string;
  insuredAmount: number;
  deductibleAmount: number;     // Calculated real deductible amount in COP
  deductibleRatio: number;      // deductible / insuredAmount
  hasCap: boolean;
  capAmount?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;                // 0-100
  recommendation?: string;
  benchmark?: {
    benchmark: string;
    assessment: string;
    notes: string;
  };
}

// SMMLV value (approximate, should be configurable)
const SMMLV_VALUE = 1300000; // ~1.3M COP

export const deductibleAnalyzer = {
  /**
   * Analyze deductible risk for a specific coverage
   * Uses the new semantic deductible parser for compound structures
   */
  analyze: async (
    coverageName: string,
    quoteDeductibleText: string,
    clauseDeductibleText: string,
    insuredAmount: number
  ): Promise<DeductibleAnalysis> => {
    console.log(`💰 [deductibleAnalyzer] Analyzing deductible for ${coverageName}...`);
    
    // Parse using new semantic parser
    const quoteStructure = await deductibleParser.parse(quoteDeductibleText);
    const clauseStructure = clauseDeductibleText ? await deductibleParser.parse(clauseDeductibleText) : null;
    
    // Use clause deductible as source of truth (or quote if clause not available)
    const effectiveStructure = clauseStructure && (
      clauseStructure.normalized.minAmount > 0 || 
      clauseStructure.normalized.maxAmount > 0 || 
      clauseStructure.normalized.percentage > 0
    ) ? clauseStructure : quoteStructure;
    
    if (!effectiveStructure || !effectiveStructure.normalized) {
      throw new Error('Failed to parse deductible structure');
    }
    
    // Calculate deductible amount based on structure
    let deductibleAmount = 0;
    let hasCap = false;
    let capAmount: number | undefined;
    
    if (effectiveStructure.normalized.isPercentageBased && insuredAmount > 0) {
      const calculatedAmount = (effectiveStructure.normalized.percentage / 100) * insuredAmount;
      deductibleAmount = Math.min(
        effectiveStructure.normalized.maxAmount || Infinity,
        Math.max(effectiveStructure.normalized.minAmount || 0, calculatedAmount)
      );
      
      // Check if there's a cap
      if (effectiveStructure.normalized.maxAmount > 0 && effectiveStructure.normalized.maxAmount < calculatedAmount) {
        hasCap = true;
        capAmount = effectiveStructure.normalized.maxAmount;
      }
    } else {
      deductibleAmount = effectiveStructure.normalized.minAmount || 0;
    }
    
    // Calculate ratio
    const deductibleRatio = insuredAmount > 0 ? deductibleAmount / insuredAmount : 0;
    
    // Evaluate against benchmarks
    const benchmark = deductibleBenchmarks.evaluate(coverageName, {
      percentage: effectiveStructure.normalized.percentage,
      minAmount: effectiveStructure.normalized.minAmount
    });
    
    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let score: number;
    
    if (deductibleRatio < 0.10) {
      riskLevel = 'LOW';
      score = 80 + Math.round((0.10 - deductibleRatio) / 0.10 * 20);
    } else if (deductibleRatio <= 0.15) {
      riskLevel = 'MEDIUM';
      score = 50 + Math.round((0.15 - deductibleRatio) / 0.05 * 29);
    } else {
      riskLevel = 'HIGH';
      score = Math.max(0, 50 - Math.round((deductibleRatio - 0.15) / 0.05 * 50));
    }
    
    // Adjust score based on benchmark
    if (benchmark.benchmark === 'excellent') {
      score = Math.min(100, score + 10);
    } else if (benchmark.benchmark === 'poor') {
      score = Math.max(0, score - 15);
    }
    
    // Generate recommendation
    let recommendation: string | undefined;
    if (riskLevel === 'HIGH') {
      recommendation = `El deducible representa el ${(deductibleRatio * 100).toFixed(1)}% del valor asegurado ($${formatCurrency(deductibleAmount)}). ${benchmark.notes}`;
    } else if (!hasCap && deductibleRatio > 0.10) {
      recommendation = `Deducible sin tope máximo. ${benchmark.notes}`;
    } else if (benchmark.benchmark === 'excellent') {
      recommendation = `✅ Deducible favorable. ${benchmark.notes}`;
    }
    
    console.log(`✅ [deductibleAnalyzer] Risk: ${riskLevel}, Score: ${score}/100, Benchmark: ${benchmark.assessment}`);
    
    return {
      coverageName,
      quoteDeductible: quoteDeductibleText,
      clauseDeductible: clauseDeductibleText,
      insuredAmount,
      deductibleAmount,
      deductibleRatio,
      hasCap,
      capAmount,
      riskLevel,
      score: Math.min(100, score),
      recommendation,
      benchmark
    };
  },
  
  /**
   * Batch analyze all deductibles in a quote
   */
  analyzeQuote: async (
    quote: any,
    clauseDeductibles: Map<string, string>
  ): Promise<DeductibleAnalysis[]> => {
    const results: DeductibleAnalysis[] = [];
    
    for (const coverage of quote.coverages || []) {
      const clauseDed = clauseDeductibles.get(coverage.name) || coverage.deductible || 'No especificado';
      const insuredAmount = parseInsuredAmount(coverage.value);
      
      if (insuredAmount > 0) {
        const analysis = await deductibleAnalyzer.analyze(
          coverage.name,
          coverage.deductible || 'No especificado',
          clauseDed,
          insuredAmount
        );
        results.push(analysis);
      }
    }
    
    return results;
  }
};

interface ParsedDeductible {
  type: 'PERCENTAGE' | 'SMMLV' | 'FIXED' | 'UNKNOWN';
  amount: number;
  capAmount: number;
}

function parseDeductible(deductibleText: string): ParsedDeductible {
  if (!deductibleText || deductibleText === 'No aplica' || deductibleText === 'NO ESPECIFICADO') {
    return { type: 'UNKNOWN', amount: 0, capAmount: 0 };
  }
  
  const text = deductibleText.toLowerCase();
  let amount = 0;
  let capAmount = 0;
  let type: 'PERCENTAGE' | 'SMMLV' | 'FIXED' | 'UNKNOWN' = 'UNKNOWN';
  
  // Check for percentage: "10%", "10 %"
  const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) {
    amount = parseFloat(percentMatch[1]);
    type = 'PERCENTAGE';
  }
  
  // Check for SMMLV: "5 SMMLV", "2 SM" (only if no percentage found)
  if (type === 'UNKNOWN') {
    const smmlvMatch = text.match(/(\d+)\s*(?:smmlv|sm)/);
    if (smmlvMatch) {
      amount = parseFloat(smmlvMatch[1]);
      type = 'SMMLV';
    }
  }
  
  // Check for fixed amount: "$500,000", "500000"
  if (type === 'UNKNOWN') {
    const fixedMatch = text.match(/[$\s]*(\d+(?:[.,]\d+)*)/);
    if (fixedMatch) {
      const cleaned = fixedMatch[1].replace(/[.,]/g, '');
      amount = parseFloat(cleaned);
      if (amount > 1000) { // Likely a fixed amount, not a percentage
        type = 'FIXED';
      }
    }
  }
  
  // Check for cap: "Máx. 500 SMMLV", "Tope $5M"
  const capMatch = text.match(/(?:máx|tope|max)\S*\s*(\d+(?:\.\d+)?)\s*(?:smmlv|sm|\$?)/i);
  if (capMatch) {
    capAmount = parseFloat(capMatch[1]);
    // If cap is in SMMLV, convert
    if (text.includes('smmlv') || text.includes('sm')) {
      capAmount = capAmount * SMMLV_VALUE;
    }
  }
  
  return { type, amount, capAmount };
}

function parseInsuredAmount(value: string): number {
  if (!value || value === 'NO ESPECIFICADO' || value === 'EXCLUIDO') {
    return 0;
  }
  
  // Extract numeric value
  const cleaned = value.replace(/[$\s.,]/g, '');
  const num = parseFloat(cleaned);
  
  if (!isNaN(num) && num > 0) {
    // Handle common suffixes
    if (value.toLowerCase().includes('m')) {
      return num * 1000000;
    }
    if (value.toLowerCase().includes('k')) {
      return num * 1000;
    }
    return num;
  }
  
  return 0;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount);
}

export default deductibleAnalyzer;
