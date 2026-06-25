/**
 * Types for the Unified Multimodal Comparison Engine
 * Based on the Excel reference structure (3 sheets: Portada, Coberturas, Primas)
 */

export interface UnifiedComparisonResult {
  metadata: {
    generatedAt: string;
    model: string;
    thinkingLevel: string;
    pdfCount: number;
    totalPages: number;
    confidence: number; // 0-1
    needsHumanReview: boolean;
    processingTimeMs: number;
    fromCache?: boolean;
  };

  client: {
    name: string;
    activity: string;
    ciiu?: string;
    address: string;
    city: string;
    totalInsuredValue: number;
  };

  insurers: Array<{
    name: string;
    quoteDate: string;
    validity: string;
    product: string;
    logo?: string;
  }>;

  coverageMatrix: Array<{
    category: string;
    isExclusive?: boolean;
    rows: Array<{
      type: 'value' | 'deductible' | 'includes' | 'exclusions' | 'notes';
      label: string;
      cells: Array<{
        value: string | null;
        rawText?: string;
        confidence?: number;
        pageNumber?: number;
        isAmbiguous?: boolean;
        notes?: string;
      }>;
    }>;
  }>;

  financials: {
    premiums: Array<{
      insurer: string;
      netPremium: number | null;
      fees: number | null;
      taxes: number | null;
      total: number | null;
      percentageOfValue: number | null;
    }>;
    metadata: Array<{
      insurer: string;
      commission?: string;
      backing?: string;
      modality?: string;
      asistencia?: string;
    }>;
  };

  analysis: {
    bestValue?: string;
    warnings: string[];
    missingCoverages: Array<{ insurer: string; coverage: string }>;
    significantDifferences: Array<{
      coverage: string;
      difference: string;
      severity: 'high' | 'medium' | 'low';
    }>;
  };
}

export interface DeductibleStructure {
  percentage?: number;
  minimum?: number;
  maximum?: number;
  fixedAmount?: number;
  currency: string; // 'COP', 'SMMLV', 'UVT'
  type: 'percentage' | 'fixed' | 'percentage_with_minimum' | 'percentage_with_maximum' | 'compound' | 'na' | 'unknown';
  rawText: string;
}

export interface ValidationResult {
  isValid: boolean;
  schemaErrors: string[];
  businessWarnings: string[];
  confidence: number;
  needsHumanReview: boolean;
}

export interface ComparisonEngineConfig {
  model: string;
  thinkingLevel: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
  responseMimeType: string;
  responseSchema: Record<string, unknown>; // JSON Schema object
  maxRetries: number;
  retryDelayMs: number;
}

export interface DeepModeResult {
  originalComparison: UnifiedComparisonResult;
  validatedComparison: UnifiedComparisonResult;
  validations: Array<{
    insurer: string;
    coverage: string;
    field: string;
    originalValue: string;
    validatedValue: string;
    source: string; // clause page number
    confidence: number;
  }>;
  discrepancies: Array<{
    insurer: string;
    type: 'deductible' | 'coverage' | 'exclusion';
    description: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}
