/**
 * Claim Deductible Simulation Service
 * Evaluates hypothetical insurance claims against structured or textual deductibles
 * for multiple insurance quotes.
 */

import { getDomainConstants } from '../config/domainConstants';
import {
  ClaimSimulationReport,
  InsurerClaimResult,
} from '../types/claimSimulation';

export interface DeductibleSimulationInput {
  insurerName: string;
  coverageName?: string;
  deductibleText?: string | null;
  deductibleStructure?: {
    components?: Array<{
      type: string;
      value: number;
      currency?: string;
    }>;
    normalized?: {
      minAmount?: number;
      maxAmount?: number;
      percentage?: number;
      isPercentageBased?: boolean;
    };
    rawText?: string;
  } | null;
}

export interface ParseDeductibleComponentsResult {
  percentage: number;
  minAmountCOP: number;
  maxAmountCOP: number;
  fixedAmountCOP: number;
  isExempt: boolean;
}

/**
 * Extracts percentage, minimums, and maximums from deductible text or structure
 */
export function extractDeductibleComponents(
  input: DeductibleSimulationInput,
  smmlvCOP: number
): ParseDeductibleComponentsResult {
  const raw = (input.deductibleStructure?.rawText || input.deductibleText || '').toLowerCase().trim();

  // Check for exemption / no deductible
  if (
    !raw ||
    raw.includes('sin deducible') ||
    raw.includes('exento') ||
    raw.includes('no aplica') ||
    raw === '0%' ||
    raw === '0' ||
    raw === 'n/a'
  ) {
    return {
      percentage: 0,
      minAmountCOP: 0,
      maxAmountCOP: 0,
      fixedAmountCOP: 0,
      isExempt: true,
    };
  }

  // 1. If structured deductible is present, prefer its normalized values
  if (input.deductibleStructure?.normalized) {
    const norm = input.deductibleStructure.normalized;
    const components = input.deductibleStructure.components || [];

    let minCOP = norm.minAmount || 0;
    let maxCOP = norm.maxAmount || 0;

    // Check components for SMMLV currencies if normalized numbers seem low
    for (const comp of components) {
      if (comp.currency === 'SMMLV' || (comp.type === 'minimum' && comp.value <= 100)) {
        if (comp.type === 'minimum' && (!minCOP || minCOP < 1000)) {
          minCOP = comp.value * smmlvCOP;
        }
        if (comp.type === 'maximum' && (!maxCOP || maxCOP < 1000)) {
          maxCOP = comp.value * smmlvCOP;
        }
      }
    }

    return {
      percentage: norm.percentage || 0,
      minAmountCOP: minCOP,
      maxAmountCOP: maxCOP,
      fixedAmountCOP: !norm.isPercentageBased && norm.minAmount ? norm.minAmount : 0,
      isExempt: false,
    };
  }

  // 2. Parse from raw text heuristics (e.g., "10% valor pérdida, mín. 5 SMMLV, máx. 50 SMMLV")
  let percentage = 0;
  let minAmountCOP = 0;
  let maxAmountCOP = 0;
  let fixedAmountCOP = 0;

  // Extract percentage: e.g. 10% or 10 %
  const pctMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch && pctMatch[1]) {
    percentage = parseFloat(pctMatch[1].replace(',', '.'));
  }

  // Extract minimum: e.g. "mín. 5 smmlv" or "minimo 5 smmlv" or "mín $2.000.000"
  const minMatch = raw.match(/(?:m[íi]n(?:imo)?\.?\s*(?:de)?)\s*(\d+(?:[.,]\d+)?)\s*(smmlv|uvt|\$|cop)?/i);
  if (minMatch && minMatch[1]) {
    const val = parseFloat(minMatch[1].replace(/\./g, '').replace(',', '.'));
    const unit = (minMatch[2] || '').toLowerCase();
    if (unit === 'smmlv' || (!unit && val <= 50)) {
      minAmountCOP = val * smmlvCOP;
    } else {
      minAmountCOP = val;
    }
  }

  // Extract maximum: e.g. "máx. 50 smmlv" or "tope 50 smmlv"
  const maxMatch = raw.match(/(?:m[áa]x(?:imo)?\.?|tope)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*(smmlv|uvt|\$|cop)?/i);
  if (maxMatch && maxMatch[1]) {
    const val = parseFloat(maxMatch[1].replace(/\./g, '').replace(',', '.'));
    const unit = (maxMatch[2] || '').toLowerCase();
    if (unit === 'smmlv' || (!unit && val <= 200)) {
      maxAmountCOP = val * smmlvCOP;
    } else {
      maxAmountCOP = val;
    }
  }

  // Extract fixed: e.g. "5 SMMLV" without percentage
  if (percentage === 0 && !minMatch && !maxMatch) {
    const fixedMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(smmlv)/i);
    if (fixedMatch && fixedMatch[1]) {
      const val = parseFloat(fixedMatch[1].replace(',', '.'));
      fixedAmountCOP = val * smmlvCOP;
    }
  }

  return {
    percentage,
    minAmountCOP,
    maxAmountCOP,
    fixedAmountCOP,
    isExempt: false,
  };
}

/**
 * Calculates client deductible and net indemnification for a specific loss amount
 */
export function calculateClaimDeductible(
  claimAmountCOP: number,
  input: DeductibleSimulationInput,
  smmlvCOP?: number
): InsurerClaimResult {
  const currentSMMLV = smmlvCOP ?? getDomainConstants().smmlv;
  const coverageName = input.coverageName || 'Amparo General';
  const rawText = input.deductibleStructure?.rawText || input.deductibleText || 'No especificado';

  if (claimAmountCOP <= 0) {
    return {
      insurerName: input.insurerName,
      coverageName,
      deductibleText: rawText,
      payableDeductibleCOP: 0,
      netIndemnificationCOP: 0,
      deductiblePercentageOfLoss: 0,
      isExempt: false,
      cappedByMaximum: false,
      raisedByMinimum: false,
    };
  }

  const components = extractDeductibleComponents(input, currentSMMLV);

  if (components.isExempt) {
    return {
      insurerName: input.insurerName,
      coverageName,
      deductibleText: rawText,
      payableDeductibleCOP: 0,
      netIndemnificationCOP: claimAmountCOP,
      deductiblePercentageOfLoss: 0,
      isExempt: true,
      cappedByMaximum: false,
      raisedByMinimum: false,
    };
  }

  let calculatedDeductible = 0;

  if (components.percentage > 0) {
    calculatedDeductible = claimAmountCOP * (components.percentage / 100);
  } else if (components.fixedAmountCOP > 0) {
    calculatedDeductible = components.fixedAmountCOP;
  } else if (components.minAmountCOP > 0) {
    calculatedDeductible = components.minAmountCOP;
  }

  let raisedByMinimum = false;
  let cappedByMaximum = false;

  // Apply minimum
  if (components.minAmountCOP > 0 && calculatedDeductible < components.minAmountCOP) {
    calculatedDeductible = components.minAmountCOP;
    raisedByMinimum = true;
  }

  // Apply maximum
  if (components.maxAmountCOP > 0 && calculatedDeductible > components.maxAmountCOP) {
    calculatedDeductible = components.maxAmountCOP;
    cappedByMaximum = true;
  }

  // Cannot exceed actual loss amount
  const payableDeductibleCOP = Math.round(Math.min(calculatedDeductible, claimAmountCOP));
  const netIndemnificationCOP = Math.round(Math.max(0, claimAmountCOP - payableDeductibleCOP));
  const deductiblePercentageOfLoss =
    claimAmountCOP > 0 ? Number(((payableDeductibleCOP / claimAmountCOP) * 100).toFixed(1)) : 0;

  return {
    insurerName: input.insurerName,
    coverageName,
    deductibleText: rawText,
    payableDeductibleCOP,
    netIndemnificationCOP,
    deductiblePercentageOfLoss,
    isExempt: false,
    cappedByMaximum,
    raisedByMinimum,
  };
}

/**
 * Simulates a claim scenario across all available quotes
 */
export function simulateClaimScenario(
  claimAmountCOP: number,
  inputs: DeductibleSimulationInput[],
  coverageTarget: string = 'Amparo Básico / Incendio'
): ClaimSimulationReport {
  const smmlv = getDomainConstants().smmlv;

  const results: InsurerClaimResult[] = inputs.map((input) =>
    calculateClaimDeductible(claimAmountCOP, input, smmlv)
  );

  // Sort by lowest deductible first (best for client)
  results.sort((a, b) => a.payableDeductibleCOP - b.payableDeductibleCOP);

  if (results.length > 0 && results[0]) {
    results[0].isBestOption = true;
  }

  let bestOption: ClaimSimulationReport['bestOption'] = undefined;
  if (results.length > 1) {
    const best = results[0];
    const worst = results[results.length - 1];
    if (best && worst) {
      bestOption = {
        insurerName: best.insurerName,
        payableDeductibleCOP: best.payableDeductibleCOP,
        savingsComparedToWorstCOP: Math.max(0, worst.payableDeductibleCOP - best.payableDeductibleCOP),
      };
    }
  }

  return {
    claimAmountCOP,
    coverageTarget,
    results,
    bestOption,
  };
}
