/**
 * Types for Premium Equation Audit and Interactive Claim Deductible Simulation
 */

export interface PremiumAuditResult {
  insurerName: string;
  isValid: boolean;
  skipped?: boolean;
  expectedTotal: number;
  actualTotal: number;
  discrepancy: number;
  tolerance: number;
  breakdown: {
    netPremium: number;
    fees: number;
    taxes: number;
    otherCharges?: number;
  };
  explanation?: string;
  alert?: {
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    title: string;
    description: string;
  };
}

export interface InsurerClaimResult {
  insurerName: string;
  coverageName: string;
  deductibleText: string;
  payableDeductibleCOP: number;
  netIndemnificationCOP: number;
  deductiblePercentageOfLoss: number;
  isExempt: boolean;
  cappedByMaximum: boolean;
  raisedByMinimum: boolean;
  isBestOption?: boolean;
}

export interface ClaimSimulationReport {
  claimAmountCOP: number;
  coverageTarget: string;
  results: InsurerClaimResult[];
  bestOption?: {
    insurerName: string;
    payableDeductibleCOP: number;
    savingsComparedToWorstCOP: number;
  };
}
