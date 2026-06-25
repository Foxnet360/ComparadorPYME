/**
 * Comparison Result Validator
 * Validates business rules and calculates confidence score for comparison results
 */

import { ValidationResult, UnifiedComparisonResult } from "../../types/unifiedComparison";

type ValidatableResult = UnifiedComparisonResult & Record<string, unknown>;

export class ComparisonResultValidator {
  
  /**
   * Validate comparison result against schema and business rules
   */
  validate(result: unknown, expectedInsurerCount: number): ValidationResult {
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
  private validateSchema(result: unknown, errors: string[]): void {
    const r = result as ValidatableResult;
    // Check required top-level fields
    const requiredFields = ['metadata', 'client', 'insurers', 'coverageMatrix', 'financials', 'analysis'];
    for (const field of requiredFields) {
      if (!r[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate metadata
    if (r.metadata) {
      const metaFields = ['generatedAt', 'model', 'thinkingLevel', 'pdfCount', 'confidence', 'needsHumanReview'];
      const metadata = r.metadata as Record<string, unknown>;
      for (const field of metaFields) {
        if (metadata[field] === undefined) {
          errors.push(`Missing metadata field: ${field}`);
        }
      }
    }

    // Validate client info
    if (r.client) {
      const clientFields = ['name', 'activity', 'address', 'city', 'totalInsuredValue'];
      const client = r.client as Record<string, unknown>;
      for (const field of clientFields) {
        if (!client[field]) {
          errors.push(`Missing client field: ${field}`);
        }
      }
    }

    // Validate insurers array
    if (!Array.isArray(r.insurers) || r.insurers.length === 0) {
      errors.push('Insurers array is empty or missing');
    } else {
      r.insurers.forEach((insurer, index) => {
        if (!insurer.name) {
          errors.push(`Insurer ${index} missing name`);
        }
      });
    }

    // Validate coverage matrix
    if (!Array.isArray(r.coverageMatrix) || r.coverageMatrix.length === 0) {
      errors.push('Coverage matrix is empty or missing');
    }

    // Validate financials
    if (r.financials) {
      if (!Array.isArray(r.financials.premiums)) {
        errors.push('Financials.premiums is not an array');
      }
      if (!Array.isArray(r.financials.metadata)) {
        errors.push('Financials.metadata is not an array');
      }
    }
  }

  /**
   * Validate business rules
   */
  private validateBusinessRules(
    result: unknown, 
    expectedInsurerCount: number, 
    warnings: string[]
  ): void {
    const r = result as ValidatableResult;
    // Check insurer count matches
    if (r.insurers && r.insurers.length !== expectedInsurerCount) {
      warnings.push(`Expected ${expectedInsurerCount} insurers but found ${r.insurers.length}`);
    }

    // Check for missing coverages
    if (r.analysis && r.analysis.missingCoverages) {
      const missingCount = r.analysis.missingCoverages.length;
      if (missingCount > 0) {
        warnings.push(`${missingCount} missing coverages detected`);
      }
    }

    // Check for significant differences
    if (r.analysis && r.analysis.significantDifferences) {
      const highSeverity = r.analysis.significantDifferences.filter(
        d => d.severity === 'high'
      );
      if (highSeverity.length > 0) {
        warnings.push(`${highSeverity.length} high-severity differences detected`);
      }
    }

    // Validate premium totals
    if (r.financials && r.financials.premiums) {
      r.financials.premiums.forEach(premium => {
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
    if (r.coverageMatrix) {
      r.coverageMatrix.forEach(section => {
        if (section.rows) {
          section.rows.forEach(row => {
            if (row.cells) {
              row.cells.forEach(cell => {
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
  private calculateConfidence(result: unknown, expectedInsurerCount: number): number {
    const r = result as ValidatableResult;
    let score = 1.0;
    let deductions = 0;

    // Deduct for missing insurers
    if (r.insurers) {
      const missingInsurers = expectedInsurerCount - r.insurers.length;
      if (missingInsurers > 0) {
        deductions += missingInsurers * 0.15;
      }
    }

    // Deduct for empty coverage matrix
    if (!r.coverageMatrix || r.coverageMatrix.length === 0) {
      deductions += 0.3;
    } else {
      // Deduct for sections with missing data
      const emptySections = r.coverageMatrix.filter(
        section => !section.rows || section.rows.length === 0
      ).length;
      deductions += emptySections * 0.05;
    }

    // Deduct for missing premiums
    if (!r.financials?.premiums || r.financials.premiums.length === 0) {
      deductions += 0.2;
    }

    // Deduct for ambiguous values
    let ambiguousCount = 0;
    if (r.coverageMatrix) {
      r.coverageMatrix.forEach(section => {
        section.rows?.forEach(row => {
          row.cells?.forEach(cell => {
            if (cell.isAmbiguous || cell.value === 'Ver condiciones' || cell.value === null) {
              ambiguousCount++;
            }
          });
        });
      });
    }
    deductions += Math.min(ambiguousCount * 0.02, 0.3);

    // Deduct for warnings
    if (r.analysis?.warnings) {
      deductions += Math.min(r.analysis.warnings.length * 0.03, 0.2);
    }

    return Math.max(0, Math.min(1, score - deductions));
  }
}

export const comparisonResultValidator = new ComparisonResultValidator();
export default comparisonResultValidator;
