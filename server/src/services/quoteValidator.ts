/**
 * Quote Validation Module
 * Pure validation functions for extracted quote data
 * All functions are deterministic and testable
 */

import { ParsedQuote } from './quoteParser';
import { getCanonicalCoverageNames, getPremiumRange } from '../config/domainConstants';
import { hybridDeductibleParser } from './hybridDeductibleParser';

export interface ValidationFlag {
  field: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  flags: ValidationFlag[];
  coverageCount: number;
  expectedCoverageCount: number;
  numericParseSuccess: boolean;
  premiumSource?: string;
}

// Expected PYME coverages loaded from the canonical taxonomy
const EXPECTED_COVERAGES = getCanonicalCoverageNames();

// Validation constants
const PREMIUM_RANGE = getPremiumRange();
const INSURED_AMOUNT_MAX = 10000000000;
const HIGH_DEDUCTIBLE_PERCENTAGE = 50;

/**
 * Validate premium amount is within reasonable range
 */
export function validatePremium(quote: ParsedQuote): ValidationFlag | null {
  if (!quote.priceAnnual || quote.priceAnnual === 0) {
    return {
      field: 'priceAnnual',
      severity: 'CRITICAL',
      message: 'Prima anual no especificada o es 0',
      code: 'PREMIUM_MISSING'
    };
  }

  if (quote.priceAnnual < PREMIUM_RANGE.min) {
    return {
      field: 'priceAnnual',
      severity: 'WARNING',
      message: `Prima anual (${quote.priceAnnual}) está por debajo del mínimo esperado (${PREMIUM_RANGE.min})`,
      code: 'PREMIUM_SUSPECT'
    };
  }

  if (quote.priceAnnual > PREMIUM_RANGE.max) {
    return {
      field: 'priceAnnual',
      severity: 'WARNING',
      message: `Prima anual (${quote.priceAnnual}) excede el máximo esperado (${PREMIUM_RANGE.max})`,
      code: 'PREMIUM_SUSPECT'
    };
  }

  return null;
}

/**
 * Validate coverage completeness
 * Uses expectedCoverages if available, otherwise falls back to coverages array
 */
export function validateCoverageCompleteness(quote: ParsedQuote): ValidationFlag | null {
  // Use expectedCoverages if available (from structured extraction)
  if ((quote as any).expectedCoverages && Array.isArray((quote as any).expectedCoverages)) {
    const expectedCoverages = (quote as any).expectedCoverages;
    const missingCount = expectedCoverages.filter((c: any) => c.status === 'missing').length;
    const excludedCount = expectedCoverages.filter((c: any) => c.status === 'excluded').length;
    const presentCount = expectedCoverages.filter((c: any) => c.status === 'present').length;
    
    if (missingCount > 0) {
      const missingNames = expectedCoverages
        .filter((c: any) => c.status === 'missing')
        .map((c: any) => c.name)
        .slice(0, 3);
      
      return {
        field: 'coverages',
        severity: 'WARNING',
        message: `Faltan ${missingCount} coberturas: ${missingNames.join(', ')}${missingCount > 3 ? '...' : ''}`,
        code: 'COVERAGES_INCOMPLETE'
      };
    }
    
    return null;
  }
  
  // Fallback to legacy validation using coverages array
  if (!quote.coverages || quote.coverages.length === 0) {
    return {
      field: 'coverages',
      severity: 'WARNING',
      message: `Faltan ${EXPECTED_COVERAGES.length} coberturas: ${EXPECTED_COVERAGES.slice(0, 3).join(', ')}...`,
      code: 'COVERAGES_INCOMPLETE'
    };
  }

  const coverageNames = quote.coverages.map(c => c.name);
  const missingCoverages = EXPECTED_COVERAGES.filter(expected => 
    !coverageNames.some(name => 
      name.toLowerCase().includes(expected.toLowerCase()) ||
      expected.toLowerCase().includes(name.toLowerCase())
    )
  );

  if (missingCoverages.length > 0) {
    return {
      field: 'coverages',
      severity: 'WARNING',
      message: `Faltan ${missingCoverages.length} coberturas: ${missingCoverages.slice(0, 3).join(', ')}${missingCoverages.length > 3 ? '...' : ''}`,
      code: 'COVERAGES_INCOMPLETE'
    };
  }

  return null;
}

/**
 * Validate deductible format using the canonical structured parser.
 *
 * Returns INFO for unknown formats and WARNING for percentages above the
 * configured threshold. Valid structured deductibles return null.
 */
export function validateDeductibleFormat(deductible: string): ValidationFlag | null {
  if (!deductible || deductible.trim() === '') {
    return null; // Empty is acceptable
  }

  const structure = hybridDeductibleParser.parseSync(deductible);

  // Zero / NA deductibles are always acceptable.
  if (structure.isZero) {
    return null;
  }

  // Unknown formats are flagged for review but do not block processing.
  if (structure.components.some((c) => c.type === 'unknown')) {
    return {
      field: 'deductible',
      severity: 'INFO',
      message: `Formato de deducible no reconocido: "${deductible}"`,
      code: 'DEDUCTIBLE_UNRECOGNIZED_FORMAT'
    };
  }

  // High percentage check.
  if (structure.normalized.percentage > HIGH_DEDUCTIBLE_PERCENTAGE) {
    return {
      field: 'deductible',
      severity: 'WARNING',
      message: `Deducible de ${structure.normalized.percentage}% es inusualmente alto`,
      code: 'DEDUCTIBLE_HIGH_PERCENTAGE'
    };
  }

  return null;
}

/**
 * Validate all coverages have proper values
 */
export function validateCoverageValues(quote: ParsedQuote): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  for (const coverage of (quote.coverages || [])) {
    // Check for missing values
    if (!coverage.value || coverage.value === '') {
      flags.push({
        field: `coverage.${coverage.name}.value`,
        severity: 'WARNING',
        message: `Cobertura "${coverage.name}" no tiene valor especificado`,
        code: 'COVERAGE_VALUE_MISSING'
      });
      continue;
    }

    // Check if value looks like a monetary amount
    if (coverage.value !== 'NO ESPECIFICADO' && coverage.value !== 'EXCLUIDO') {
      const numericValue = parseFloat(coverage.value.replace(/[$\s.,]/g, ''));
      if (!isNaN(numericValue) && numericValue > INSURED_AMOUNT_MAX) {
        flags.push({
          field: `coverage.${coverage.name}.value`,
          severity: 'WARNING',
          message: `Valor asegurado ${coverage.value} excede el máximo esperado`,
          code: 'COVERAGE_VALUE_TOO_HIGH'
        });
      }
    }

    // Validate deductible
    const deductibleFlag = validateDeductibleFormat(coverage.deductible);
    if (deductibleFlag) {
      flags.push({
        ...deductibleFlag,
        field: `coverage.${coverage.name}.deductible`
      });
    }
  }

  return flags;
}

/**
 * Check if a coverage value is valid (numeric or descriptive text)
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
  
  return validPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Validate numeric fields parse correctly
 */
export function validateNumericParsing(quote: ParsedQuote): ValidationFlag | null {
  const hasInvalidNumeric = (quote.coverages || []).some(c => {
    if (c.value === 'NO ESPECIFICADO' || c.value === 'EXCLUIDO') return false;
    return !isValidCoverageValue(c.value);
  });

  if (hasInvalidNumeric) {
    return {
      field: 'coverages',
      severity: 'WARNING',
      message: 'Algunos valores numéricos no pudieron ser parseados correctamente',
      code: 'NUMERIC_PARSE_ERROR'
    };
  }

  return null;
}

/**
 * Validate cross-field consistency
 */
export function validateConsistency(quote: ParsedQuote): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  // Check currency consistency
  if (quote.currency === 'COP' && quote.coverages && quote.coverages.length > 0) {
    const hasUSDFormat = quote.coverages.some(c => 
      c.value.includes('$') && !c.value.includes('.')
    );
    if (hasUSDFormat) {
      flags.push({
        field: 'currency',
        severity: 'INFO',
        message: 'Moneda es COP pero algunos valores usan formato USD',
        code: 'CURRENCY_FORMAT_MISMATCH'
      });
    }
  }

  // Check if total coverage values are reasonable compared to premium
  const coverageValues = (quote.coverages || [])
    .map(c => {
      if (c.value === 'NO ESPECIFICADO' || c.value === 'EXCLUIDO') return 0;
      return parseFloat(c.value.replace(/[$\s.,]/g, '')) || 0;
    })
    .filter(v => v > 0);

  if (coverageValues.length > 0 && quote.priceAnnual > 0) {
    const totalCoverage = coverageValues.reduce((a, b) => a + b, 0);
    if (totalCoverage < quote.priceAnnual * 10) {
      flags.push({
        field: 'coverages',
        severity: 'INFO',
        message: 'Suma total de coberturas es baja en relación a la prima (posible subaseguro)',
        code: 'PREMIUM_COVERAGE_RATIO'
      });
    }
  }

  return flags;
}

/**
 * Main validation function - runs all validators
 */
export function validateQuote(quote: ParsedQuote): ValidationResult {
  const flags: ValidationFlag[] = [];

  // Run all validators
  const premiumFlag = validatePremium(quote);
  if (premiumFlag) flags.push(premiumFlag);

  const completenessFlag = validateCoverageCompleteness(quote);
  if (completenessFlag) flags.push(completenessFlag);

  const valueFlags = validateCoverageValues(quote);
  flags.push(...valueFlags);

  const numericFlag = validateNumericParsing(quote);
  if (numericFlag) flags.push(numericFlag);

  const consistencyFlags = validateConsistency(quote);
  flags.push(...consistencyFlags);

  // Determine overall validity
  const criticalCount = flags.filter(f => f.severity === 'CRITICAL').length;
  const hasCriticalErrors = criticalCount > 0;

  return {
    isValid: !hasCriticalErrors,
    flags,
    coverageCount: quote.coverages?.length || 0,
    expectedCoverageCount: EXPECTED_COVERAGES.length,
    numericParseSuccess: !numericFlag,
    premiumSource: (quote as any).premiumSource || 'unknown'
  };
}

/**
 * Get validation summary for display
 */
export function getValidationSummary(result: ValidationResult): string {
  const critical = result.flags.filter(f => f.severity === 'CRITICAL').length;
  const warnings = result.flags.filter(f => f.severity === 'WARNING').length;
  const info = result.flags.filter(f => f.severity === 'INFO').length;

  return `${result.coverageCount}/${result.expectedCoverageCount} coberturas | ${critical} críticas | ${warnings} advertencias | ${info} info`;
}
