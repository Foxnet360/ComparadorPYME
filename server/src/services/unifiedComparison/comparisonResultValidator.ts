/**
 * Comparison Result Validator
 * Validates business rules and calculates confidence score for comparison results
 */

import { UnifiedComparisonResult, ValidationResult } from "../../types/unifiedComparison";

export class ComparisonResultValidator {
  
  /**
   * Validate comparison result against schema and business rules
   */
  validate(result: any, expectedInsurerCount: number): ValidationResult {
    const schemaErrors: string[] = [];
    const businessWarnings: string[] = [];
    
    // Schema validation
    this.validateSchema(result, schemaErrors);
    
    // Business rules validation
    this.validateBusinessRules(result, expectedInsurerCount, businessWarnings);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(result, expectedInsurerCount);
    
    return {
      isValid: schemaErrors.length === 0,
      schemaErrors,
      businessWarnings,
      confidence,
      needsHumanReview: confidence < 0.90 || schemaErrors.length > 0
    };
  }

  /**
   * Validate JSON schema structure
   */
  private validateSchema(result: any, errors: string[]): void {
    // Check required top-level fields
    const requiredFields = ['metadata', 'client', 'insurers', 'coverageMatrix', 'financials', 'analysis'];
    for (const field of requiredFields) {
      if (!result[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate metadata
    if (result.metadata) {
      const metaFields = ['generatedAt', 'model', 'thinkingLevel', 'pdfCount', 'confidence', 'needsHumanReview'];
      for (const field of metaFields) {
        if (result.metadata[field] === undefined) {
          errors.push(`Missing metadata field: ${field}`);
        }
      }
    }

    // Validate client info
    if (result.client) {
      const clientFields = ['name', 'activity', 'address', 'city', 'totalInsuredValue'];
      for (const field of clientFields) {
        if (!result.client[field]) {
          errors.push(`Missing client field: ${field}`);
        }
      }
    }

    // Validate insurers array
    if (!Array.isArray(result.insurers) || result.insurers.length === 0) {
      errors.push('Insurers array is empty or missing');
    } else {
      result.insurers.forEach((insurer: any, index: number) => {
        if (!insurer.name) {
          errors.push(`Insurer ${index} missing name`);
        }
      });
    }

    // Validate coverage matrix
    if (!Array.isArray(result.coverageMatrix) || result.coverageMatrix.length === 0) {
      errors.push('Coverage matrix is empty or missing');
    }

    // Validate financials
    if (result.financials) {
      if (!Array.isArray(result.financials.premiums)) {
        errors.push('Financials.premiums is not an array');
      }
      if (!Array.isArray(result.financials.metadata)) {
        errors.push('Financials.metadata is not an array');
      }
    }
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(
    result: any, 
    expectedInsurerCount: number, 
    warnings: string[]
  ): void {
    // Check insurer count matches
    if (result.insurers && result.insurers.length !== expectedInsurerCount) {
      warnings.push(`Expected ${expectedInsurerCount} insurers but found ${result.insurers.length}`);
    }

    // Check for missing coverages
    if (result.analysis && result.analysis.missingCoverages) {
      const missingCount = result.analysis.missingCoverages.length;
      if (missingCount > 0) {
        warnings.push(`${missingCount} missing coverages detected`);
      }
    }

    // Check for significant differences
    if (result.analysis && result.analysis.significantDifferences) {
      const highSeverity = result.analysis.significantDifferences.filter(
        (d: any) => d.severity === 'high'
      );
      if (highSeverity.length > 0) {
        warnings.push(`${highSeverity.length} high-severity differences detected`);
      }
    }

    // Validate premium totals
    if (result.financials && result.financials.premiums) {
      result.financials.premiums.forEach((premium: any) => {
        if (premium.total && premium.netPremium) {
          const expectedTotal = premium.netPremium + (premium.fees || 0) + (premium.taxes || 0);
          if (Math.abs(premium.total - expectedTotal) > 1) {
            warnings.push(`Premium total mismatch for ${premium.insurer}: ${premium.total} vs expected ${expectedTotal}`);
          }
        }
      });
    }

    // Check for ambiguous values
    let ambiguousCount = 0;
    if (result.coverageMatrix) {
      result.coverageMatrix.forEach((section: any) => {
        if (section.rows) {
          section.rows.forEach((row: any) => {
            if (row.cells) {
              row.cells.forEach((cell: any) => {
                if (cell.isAmbiguous) {
                  ambiguousCount++;
                }
                if (cell.value === 'Ver condiciones') {
                  ambiguousCount++;
                }
              });
            }
          });
        }
      });
    }
    
    if (ambiguousCount > 0) {
      warnings.push(`${ambiguousCount} ambiguous values detected (may need human review)`);
    }
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(result: any, expectedInsurerCount: number): number {
    let score = 1.0;
    let deductions = 0;

    // Deduct for missing insurers
    if (result.insurers) {
      const missingInsurers = expectedInsurerCount - result.insurers.length;
      if (missingInsurers > 0) {
        deductions += missingInsurers * 0.15;
      }
    }

    // Deduct for empty coverage matrix
    if (!result.coverageMatrix || result.coverageMatrix.length === 0) {
      deductions += 0.3;
    } else {
      // Deduct for sections with missing data
      const emptySections = result.coverageMatrix.filter(
        (section: any) => !section.rows || section.rows.length === 0
      ).length;
      deductions += emptySections * 0.05;
    }

    // Deduct for missing premiums
    if (!result.financials?.premiums || result.financials.premiums.length === 0) {
      deductions += 0.2;
    }

    // Deduct for ambiguous values
    let ambiguousCount = 0;
    if (result.coverageMatrix) {
      result.coverageMatrix.forEach((section: any) => {
        section.rows?.forEach((row: any) => {
          row.cells?.forEach((cell: any) => {
            if (cell.isAmbiguous || cell.value === 'Ver condiciones' || cell.value === null) {
              ambiguousCount++;
            }
          });
        });
      });
    }
    deductions += Math.min(ambiguousCount * 0.02, 0.3);

    // Deduct for warnings
    if (result.analysis?.warnings) {
      deductions += Math.min(result.analysis.warnings.length * 0.03, 0.2);
    }

    return Math.max(0, Math.min(1, score - deductions));
  }
}

export const comparisonResultValidator = new ComparisonResultValidator();
export default comparisonResultValidator;
