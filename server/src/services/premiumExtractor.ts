/**
 * Premium Extractor Module
 * Multi-strategy premium extraction with regex fallback
 */

import { normalizeColombianNumbers } from './textPreprocessor';

export type PremiumSource = 'structured' | 'regex_fallback' | 'prompt_retry' | 'unknown';

export interface PremiumExtractionResult {
  priceAnnual: number;
  currency: string;
  source: PremiumSource;
  confidence: number; // 0-100
}

const PREMIUM_PATTERNS = [
  // "prima anual" or "prima total" or "prima neta" followed by number
  /prima\s+(?:anual|total|neta)[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // "prima" followed by number
  /prima[:\s]+(?:\$\s*)?(\d[\d.,]+)/i,
  // "total a pagar" followed by number
  /total\s+a\s+pagar[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // "valor total" followed by number (with optional text in between)
  /valor\s+total(?:\s+\w+){0,5}[:\s]*(?:\$\s*)?(\d[\d.,]+)/i,
  // Generic number with currency context
  /(?:\$\s*)?(\d[\d.,]+)\s*(?:COP|USD)/i,
];

// Valid premium range for Colombian PYME insurance
const MIN_PREMIUM = 100000; // 100K COP
const MAX_PREMIUM = 500000000; // 500M COP

/**
 * Extract premium using regex patterns from preprocessed text
 */
export function extractPremiumWithRegex(text: string): PremiumExtractionResult | null {
  if (!text || text.length === 0) return null;

  // Normalize Colombian numbers first
  const normalizedText = normalizeColombianNumbers(text);

  for (const pattern of PREMIUM_PATTERNS) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      // After normalization, numbers are in format 1234567.89
      // Just remove any remaining commas and parse
      const rawValue = match[1].replace(/,/g, '');
      const value = parseFloat(rawValue);

      if (!isNaN(value) && value > 0) {
        const isValidRange = value >= MIN_PREMIUM && value <= MAX_PREMIUM;
        
        return {
          priceAnnual: Math.round(value),
          currency: 'COP',
          source: 'regex_fallback',
          confidence: isValidRange ? 75 : 50, // Lower confidence if outside normal range
        };
      }
    }
  }

  return null;
}

/**
 * Validate premium value
 */
export function validatePremium(value: number): { valid: boolean; suspect: boolean } {
  if (value <= 0) return { valid: false, suspect: false };
  if (value < MIN_PREMIUM || value > MAX_PREMIUM) return { valid: true, suspect: true };
  return { valid: true, suspect: false };
}

/**
 * Create enhanced prompt for Gemini retry with explicit premium focus
 */
export function createPremiumPrompt(basePrompt: string): string {
  return `${basePrompt}

INSTRUCCIONES ESPECÍFICAS PARA PRIMA:
1. Busca específicamente la "prima anual", "prima neta", "total a pagar" o "valor total"
2. El valor suele estar en pesos colombianos (COP)
3. Los formatos numéricos pueden usar puntos como separadores de miles: 1.234.567,89
4. Si no encuentras prima, marca priceAnnual como 0
5. Si la prima está en millones, conviértela a valor numérico (ej: 1.5 millones = 1500000)

IMPORTANTE: Extrae el valor numérico exacto de la prima anual total.`;
}

/**
 * Premium extraction result with validation flags
 */
export interface ValidatedPremiumResult extends PremiumExtractionResult {
  isValid: boolean;
  isSuspect: boolean;
}

/**
 * Full premium extraction pipeline
 */
export function extractAndValidatePremium(
  structuredPrice: number,
  preprocessedText: string
): ValidatedPremiumResult {
  // Strategy 1: Use structured extraction if valid
  if (structuredPrice > 0) {
    const validation = validatePremium(structuredPrice);
    return {
      priceAnnual: structuredPrice,
      currency: 'COP',
      source: 'structured',
      confidence: validation.suspect ? 70 : 95,
      isValid: validation.valid,
      isSuspect: validation.suspect,
    };
  }

  // Strategy 2: Try regex fallback
  const regexResult = extractPremiumWithRegex(preprocessedText);
  if (regexResult) {
    const validation = validatePremium(regexResult.priceAnnual);
    return {
      ...regexResult,
      isValid: validation.valid,
      isSuspect: validation.suspect,
    };
  }

  // Strategy 3: No premium found
  return {
    priceAnnual: 0,
    currency: 'COP',
    source: 'unknown',
    confidence: 0,
    isValid: false,
    isSuspect: false,
  };
}

// ==================== V2: Premium Breakdown Extraction ====================

export interface PremiumBreakdown {
  netPremium: number;
  fees: number;
  taxes: number;
  otherCharges: number;
  totalPayable: number;
  currency: string;
  periodicity: string;
}

export interface PerCoveragePremium {
  coverageName: string;
  premium: number;
}

export interface PremiumValidationResult {
  isValid: boolean;
  isConsistent: boolean;
  perCoverageSumMatches: boolean;
  warnings: string[];
}

/**
 * Extract premium breakdown with all components
 */
export function extractPremiumBreakdown(data: any): PremiumBreakdown {
  const premium = data.premium || {};
  
  return {
    netPremium: premium.netPremium || 0,
    fees: premium.fees || 0,
    taxes: premium.taxes || 0,
    otherCharges: premium.otherCharges || 0,
    totalPayable: premium.totalPayable || 0,
    currency: premium.currency || 'COP',
    periodicity: premium.periodicity || 'ANUAL',
  };
}

/**
 * Extract per-coverage premiums from raw coverages
 */
export function extractPerCoveragePremiums(rawCoverages: any[]): PerCoveragePremium[] {
  return rawCoverages
    .filter((c: any) => c.premium && c.premium > 0)
    .map((c: any) => ({
      coverageName: c.rawName || c.name || 'Unknown',
      premium: c.premium,
    }));
}

/**
 * Validate premium consistency (sum of components should equal total)
 */
export function validatePremiumConsistency(breakdown: PremiumBreakdown): PremiumValidationResult {
  const warnings: string[] = [];
  
  // Check if components sum to total
  const sum = breakdown.netPremium + breakdown.fees + breakdown.taxes + breakdown.otherCharges;
  const isConsistent = Math.abs(sum - breakdown.totalPayable) <= (breakdown.totalPayable * 0.01); // ±1% tolerance
  
  if (!isConsistent && breakdown.totalPayable > 0) {
    warnings.push(`Desglose inconsistente: ${sum} ≠ ${breakdown.totalPayable}`);
  }
  
  // Validate individual components
  if (breakdown.netPremium <= 0 && breakdown.totalPayable > 0) {
    warnings.push('Prima neta no encontrada');
  }
  
  return {
    isValid: breakdown.totalPayable > 0,
    isConsistent,
    perCoverageSumMatches: true, // Will be checked separately
    warnings,
  };
}

/**
 * Validate that per-coverage premiums sum to net premium
 */
export function validatePerCoverageSum(
  perCoveragePremiums: PerCoveragePremium[],
  netPremium: number
): PremiumValidationResult {
  const warnings: string[] = [];
  
  if (perCoveragePremiums.length === 0 || netPremium <= 0) {
    return {
      isValid: true,
      isConsistent: true,
      perCoverageSumMatches: true,
      warnings: [],
    };
  }
  
  const sum = perCoveragePremiums.reduce((total, p) => total + p.premium, 0);
  const matches = Math.abs(sum - netPremium) <= (netPremium * 0.1); // ±10% tolerance
  
  if (!matches) {
    warnings.push(`Primas por cobertura (${sum}) no cuadran con prima neta (${netPremium})`);
  }
  
  return {
    isValid: true,
    isConsistent: true,
    perCoverageSumMatches: matches,
    warnings,
  };
}

/**
 * Normalize currency code
 */
export function normalizeCurrency(currency: string): string {
  const upper = currency.toUpperCase();
  if (upper.includes('COP') || upper.includes('PESO')) return 'COP';
  if (upper.includes('USD') || upper.includes('DÓLAR') || upper.includes('DOLAR')) return 'USD';
  return 'COP';
}

/**
 * Normalize periodicity
 */
export function normalizePeriodicity(periodicity: string): string {
  const upper = periodicity.toUpperCase();
  if (upper.includes('ANUAL') || upper.includes('ANUAL')) return 'ANUAL';
  if (upper.includes('SEMESTRAL')) return 'SEMESTRAL';
  if (upper.includes('TRIMESTRAL')) return 'TRIMESTRAL';
  if (upper.includes('MENSUAL')) return 'MENSUAL';
  return 'ANUAL';
}

/**
 * Complete premium validation pipeline
 */
export function validatePremiumBreakdown(
  breakdown: PremiumBreakdown,
  perCoveragePremiums: PerCoveragePremium[]
): PremiumValidationResult {
  const consistencyResult = validatePremiumConsistency(breakdown);
  const sumResult = validatePerCoverageSum(perCoveragePremiums, breakdown.netPremium);
  
  return {
    isValid: consistencyResult.isValid,
    isConsistent: consistencyResult.isConsistent,
    perCoverageSumMatches: sumResult.perCoverageSumMatches,
    warnings: [...consistencyResult.warnings, ...sumResult.warnings],
  };
}
