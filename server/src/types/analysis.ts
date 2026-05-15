export interface CoverageVariables {
  rawName: string;
  displayName?: string;
  insurerName: string;
  insuredAmount?: {
    value: number;
    currency: string;
    rawText: string;
  };
  deductible?: {
    components: Array<{
      type: string;
      value: number;
      currency?: string;
    }>;
    normalized: {
      minAmount: number;
      maxAmount: number;
      percentage: number;
      isPercentageBased: boolean;
    };
    rawText: string;
  };
  sublimit?: {
    value: number;
    type: string;
    rawText: string;
  };
  exclusions: string[];
  conditions: string[];
  confidence: number;
}

export interface VariableComparison {
  groupName: string;
  groupId: string;
  variables: CoverageVariables[];
  analysis: {
    bestInsuredAmount?: string;
    bestDeductible?: string;
    mostComprehensive?: string;
    bestPrice?: string;
  };
  exclusiveCoverages: Array<{
    insurerName: string;
    rawName: string;
  }>;
}