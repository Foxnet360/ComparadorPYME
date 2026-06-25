/**
 * Excel Structure Validator
 * Validates UnifiedComparisonResult against the reference Excel structure
 * 
 * The reference Excel has 3 sheets:
 * 1. Portada (Cover) - Client info, insured assets
 * 2. Coberturas (Coverages) - Coverage comparison matrix
 * 3. Primas (Premiums) - Financial breakdown
 */

import { UnifiedComparisonResult } from '../../types/unifiedComparison';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  coverageCategories: string[];
  insurerCount: number;
  totalCoverageRows: number;
}

/**
 * Expected coverage categories from reference Excel
 */
const EXPECTED_COVERAGE_CATEGORIES = [
  'INFORMACIÓN GENERAL',
  'AMPARO BÁSICO / TODO RIESGO DAÑO MATERIAL',
  'TERREMOTO / TEMBLOR / ERUPCIÓN VOLCÁNICA',
  'AMIT / HMACC',
  'DAÑO INTERNO / EQUIPO ELÉCTRICO Y ELECTRÓNICO',
  'EQUIPOS MÓVILES Y PORTÁTILES',
  'HURTO CALIFICADO / SUSTRACCIÓN CON VIOLENCIA',
  'HURTO SIMPLE',
  'LUCRO CESANTE / PÉRDIDAS CONSECUENCIALES',
  'INFIDELIDAD DE EMPLEADOS',
  'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL (RCE)',
  'ACCIDENTES PERSONALES',
  'ROTURA DE MAQUINARIA',
  'TRANSPORTE DE BIENES',
  'DINERO Y VALORES',
  'VIDRIOS PLANOS'
];

/**
 * Expected metadata fields
 */
const EXPECTED_METADATA_FIELDS = [
  'generatedAt',
  'model',
  'thinkingLevel',
  'pdfCount',
  'confidence',
  'needsHumanReview'
];

/**
 * Validate UnifiedComparisonResult structure
 */
export function validateAgainstExcelStructure(
  result: UnifiedComparisonResult
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate metadata
  if (!result.metadata) {
    errors.push('Missing metadata section');
  } else {
    const missingMetaFields = EXPECTED_METADATA_FIELDS.filter(
      field => !(field in result.metadata)
    );
    if (missingMetaFields.length > 0) {
      warnings.push(`Missing metadata fields: ${missingMetaFields.join(', ')}`);
    }
  }

  // 2. Validate client info
  if (!result.client) {
    errors.push('Missing client section');
  } else {
    const requiredClientFields = ['name', 'activity', 'address', 'city'];
    const missingClientFields = requiredClientFields.filter(
      field => !(field in result.client)
    );
    if (missingClientFields.length > 0) {
      warnings.push(`Missing client fields: ${missingClientFields.join(', ')}`);
    }
  }

  // 3. Validate insurers
  if (!result.insurers || result.insurers.length === 0) {
    errors.push('No insurers found in result');
  } else {
    result.insurers.forEach((insurer, idx) => {
      if (!insurer.name) {
        errors.push(`Insurer ${idx + 1} missing name`);
      }
    });
  }

  // 4. Validate coverage matrix
  if (!result.coverageMatrix || result.coverageMatrix.length === 0) {
    errors.push('No coverage matrix found');
  } else {
    // Check for expected categories
    const foundCategories = result.coverageMatrix.map(c => c.category);
    const missingCategories = EXPECTED_COVERAGE_CATEGORIES.filter(
      cat => !foundCategories.some(found => 
        found.toLowerCase().includes(cat.toLowerCase()) ||
        cat.toLowerCase().includes(found.toLowerCase())
      )
    );
    
    if (missingCategories.length > 0) {
      warnings.push(
        `Missing expected coverage categories (${missingCategories.length}/${EXPECTED_COVERAGE_CATEGORIES.length}): ${missingCategories.slice(0, 3).join(', ')}...`
      );
    }

    // Validate each section has rows
    result.coverageMatrix.forEach((section, _idx) => {
      if (!section.rows || section.rows.length === 0) {
        warnings.push(`Coverage section "${section.category}" has no rows`);
      }
    });
  }

  // 5. Validate financials
  if (!result.financials) {
    errors.push('Missing financials section');
  } else {
    if (!result.financials.premiums || result.financials.premiums.length === 0) {
      warnings.push('No premium data found');
    } else {
      // Check each insurer has premium data
      result.financials.premiums.forEach((premium, idx) => {
        if (!premium.total && premium.total !== 0) {
          warnings.push(`Insurer ${idx + 1} missing total premium`);
        }
      });
    }
  }

  // 6. Validate insurer consistency
  const insurerCount = result.insurers?.length || 0;
  const coverageInsurerCount = result.coverageMatrix?.[0]?.rows?.[0]?.cells?.length || 0;
  const premiumInsurerCount = result.financials?.premiums?.length || 0;

  if (insurerCount > 0) {
    if (coverageInsurerCount !== insurerCount) {
      errors.push(
        `Insurer count mismatch: ${insurerCount} insurers but ${coverageInsurerCount} coverage columns`
      );
    }
    if (premiumInsurerCount !== insurerCount) {
      errors.push(
        `Insurer count mismatch: ${insurerCount} insurers but ${premiumInsurerCount} premium entries`
      );
    }
  }

  // 7. Validate confidence
  if (result.metadata?.confidence !== undefined) {
    if (result.metadata.confidence < 0 || result.metadata.confidence > 1) {
      errors.push(`Invalid confidence score: ${result.metadata.confidence} (should be 0-1)`);
    }
    if (result.metadata.confidence < 0.5) {
      warnings.push(`Low confidence score: ${result.metadata.confidence}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    coverageCategories: result.coverageMatrix?.map(c => c.category) || [],
    insurerCount,
    totalCoverageRows: result.coverageMatrix?.reduce((sum, section) => sum + (section.rows?.length || 0), 0) || 0
  };
}

/**
 * Quick validation for API responses
 */
export function quickValidate(result: UnifiedComparisonResult): boolean {
  const validation = validateAgainstExcelStructure(result);
  return validation.valid && validation.warnings.length < 5;
}

/**
 * Get coverage coverage percentage vs reference
 */
export function getCoverageCompleteness(result: UnifiedComparisonResult): number {
  if (!result.coverageMatrix || result.coverageMatrix.length === 0) return 0;
  
  const foundCategories = result.coverageMatrix.map(c => c.category.toLowerCase());
  const matchedCategories = EXPECTED_COVERAGE_CATEGORIES.filter(expected =>
    foundCategories.some(found => 
      found.includes(expected.toLowerCase()) ||
      expected.toLowerCase().includes(found)
    )
  );
  
  return Math.round((matchedCategories.length / EXPECTED_COVERAGE_CATEGORIES.length) * 100);
}