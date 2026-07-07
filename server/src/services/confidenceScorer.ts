/**
 * Confidence Scoring Module
 * Calculates extraction confidence based on multiple quality indicators
 */

import { ParsedQuote } from './quoteParser';
import { ValidationResult } from './quoteValidator';

export interface ConfidenceBreakdown {
  coverageCompleteness: number; // 30%
  numericParseSuccess: number; // 25%
  validationPassRate: number; // 25%
  schemaCompliance: number; // 20%
}

export interface ConfidenceResult {
  score: number;
  breakdown: ConfidenceBreakdown;
  needsReview: boolean;
  isCritical: boolean;
}

// Thresholds
export const HIGH_CONFIDENCE_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 75;
export const CRITICAL_THRESHOLD = 50;

// Weights (must sum to 1.0)
const WEIGHTS = {
  coverageCompleteness: 0.3,
  numericParseSuccess: 0.25,
  validationPassRate: 0.25,
  schemaCompliance: 0.2,
};

/**
 * Calculate coverage completeness score (0-100)
 * Based on ratio of present coverages to expected 14
 * Uses expectedCoverages if available from structured extraction
 */
function calculateCoverageCompleteness(quote: ParsedQuote): number {
  // Use expectedCoverages if available for more accurate scoring
  if (quote.expectedCoverages && Array.isArray(quote.expectedCoverages)) {
    const expectedCoverages = quote.expectedCoverages;
    const expectedCount = expectedCoverages.length;
    const presentCount = expectedCoverages.filter((c) => c.status === 'present').length;

    if (expectedCount === 0) return 0;

    // Real quotes typically have 5-10 coverages, not all 14
    // Score based on realistic expectations: 6+ coverages = 100%
    const realisticTarget = 6;
    if (presentCount >= realisticTarget) return 100;
    return Math.min(100, (presentCount / realisticTarget) * 100);
  }

  // Fallback to legacy calculation
  if (!quote.coverages || quote.coverages.length === 0) return 0;

  const realisticTarget = 6; // Realistic number of coverages in a quote
  const presentCount = quote.coverages.filter(
    (c) => c.value && c.value !== 'NO ESPECIFICADO' && c.value !== 'EXCLUIDO'
  ).length;

  if (presentCount >= realisticTarget) return 100;
  return Math.min(100, (presentCount / realisticTarget) * 100);
}

/**
 * Check if a coverage value is valid (numeric or descriptive text)
 * Descriptive texts like "INCLUIDA", "APLICA", "Seguro al 100%" are valid
 */
function isValidCoverageValue(value: string): boolean {
  if (!value || value === 'NO ESPECIFICADO' || value === 'EXCLUIDO') return false;

  const trimmed = value.trim().toLowerCase();

  // Numeric values
  const cleaned = value.replace(/[$\s.,]/g, '');
  if (!isNaN(parseFloat(cleaned)) && cleaned !== '') return true;

  // Common descriptive values that indicate valid coverage
  const validPatterns = [
    /^incluid[oa]/i,
    /^aplica/i,
    /^seguro\s+al/i,
    /^hasta\s+el/i,
    /^cobertura/i,
    /^amparo/i,
    /^garantía/i,
    /^sublímite/i,
    /^deducible/i,
    /^franquicia/i,
    /^\d+%/,
  ];

  return validPatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Calculate numeric parse success score (0-100)
 */
function calculateNumericParseSuccess(quote: ParsedQuote): number {
  if (!quote.coverages || quote.coverages.length === 0) return 0;

  let totalNumericFields = 0;
  let successfulParses = 0;

  // Check premium
  if (quote.priceAnnual > 0) {
    totalNumericFields++;
    successfulParses++;
  }

  // Check coverage values
  for (const coverage of quote.coverages) {
    if (coverage.value && coverage.value !== 'NO ESPECIFICADO' && coverage.value !== 'EXCLUIDO') {
      totalNumericFields++;
      if (isValidCoverageValue(coverage.value)) {
        successfulParses++;
      }
    }
  }

  if (totalNumericFields === 0) return 0;
  return (successfulParses / totalNumericFields) * 100;
}

/**
 * Calculate validation pass rate (0-100)
 */
function calculateValidationPassRate(validation: ValidationResult): number {
  const totalChecks = 6; // Number of validation checks we perform

  let passedChecks = 0;

  // Check 1: Coverage completeness (realistic: 5+ coverages is acceptable)
  if (validation.coverageCount >= 5) passedChecks++;

  // Check 2: No critical errors
  const criticalCount = validation.flags.filter((f) => f.severity === 'CRITICAL').length;
  if (criticalCount === 0) passedChecks++;

  // Check 3: Numeric parse success
  if (validation.numericParseSuccess) passedChecks++;

  // Check 4: Premium exists
  const hasPremium = !validation.flags.some((f) => f.code === 'PREMIUM_MISSING');
  if (hasPremium) passedChecks++;

  // Check 5: Deductible formats valid
  const hasDeductibleErrors = validation.flags.some(
    (f) => f.code === 'DEDUCTIBLE_UNRECOGNIZED_FORMAT'
  );
  if (!hasDeductibleErrors) passedChecks++;

  // Check 6: Less than 3 warnings
  const warningCount = validation.flags.filter((f) => f.severity === 'WARNING').length;
  if (warningCount < 3) passedChecks++;

  return (passedChecks / totalChecks) * 100;
}

/**
 * Calculate schema compliance score (0-100)
 * Based on whether all required fields are present
 */
function calculateSchemaCompliance(quote: ParsedQuote): number {
  let score = 0;

  // Required fields
  if (quote.insurerName && quote.insurerName !== 'NO ESPECIFICADO') score += 25;
  if (quote.policyName && quote.policyName !== 'NO ESPECIFICADO') score += 25;
  if (quote.priceAnnual > 0) score += 25;
  if (quote.coverages && quote.coverages.length > 0) score += 25;

  return score;
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidence(
  quote: ParsedQuote,
  validation: ValidationResult,
  isStructured: boolean = false
): ConfidenceResult {
  // Calculate components
  const coverageCompleteness = calculateCoverageCompleteness(quote);
  const numericParseSuccess = calculateNumericParseSuccess(quote);
  const validationPassRate = calculateValidationPassRate(validation);

  // Schema compliance bonus for structured extraction
  let schemaCompliance = calculateSchemaCompliance(quote);
  if (isStructured) {
    schemaCompliance = Math.min(100, schemaCompliance * 1.2); // 20% bonus for JSON mode
  }

  // Calculate weighted score
  let score = Math.round(
    coverageCompleteness * WEIGHTS.coverageCompleteness +
      numericParseSuccess * WEIGHTS.numericParseSuccess +
      validationPassRate * WEIGHTS.validationPassRate +
      schemaCompliance * WEIGHTS.schemaCompliance
  );

  // Reduce score by 25 points if premium is missing or suspect
  const hasPremiumIssue = validation.flags.some(
    (f) => f.code === 'PREMIUM_MISSING' || f.code === 'PREMIUM_SUSPECT'
  );
  if (hasPremiumIssue) {
    score -= 25;
  }

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  return {
    score: clampedScore,
    breakdown: {
      coverageCompleteness: Math.round(coverageCompleteness),
      numericParseSuccess: Math.round(numericParseSuccess),
      validationPassRate: Math.round(validationPassRate),
      schemaCompliance: Math.round(schemaCompliance),
    },
    needsReview: clampedScore < REVIEW_THRESHOLD,
    isCritical: clampedScore < CRITICAL_THRESHOLD,
  };
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(score: number): string {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'Alta';
  if (score >= REVIEW_THRESHOLD) return 'Media';
  if (score >= CRITICAL_THRESHOLD) return 'Baja';
  return 'Crítica';
}

/**
 * Get confidence color for UI
 */
export function getConfidenceColor(score: number): string {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'green';
  if (score >= REVIEW_THRESHOLD) return 'yellow';
  if (score >= CRITICAL_THRESHOLD) return 'orange';
  return 'red';
}

/**
 * Format confidence for display
 */
export function formatConfidence(result: ConfidenceResult): string {
  const label = getConfidenceLabel(result.score);
  const needsReview = result.needsReview ? ' [Revisar]' : '';
  return `${result.score}/100 (${label})${needsReview}`;
}
