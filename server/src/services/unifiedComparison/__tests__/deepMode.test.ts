/**
 * Deep Mode Tests
 * Tests validation with clause PDFs
 */

import { deepClauseValidator } from '../deepClauseValidator';
import { UnifiedComparisonResult } from '../../types/unifiedComparison';
import * as fs from 'fs';

interface DeepClauseValidatorWithApply {
  applyValidations: (
    comparison: UnifiedComparisonResult,
    validationResult: Record<string, unknown>
  ) => UnifiedComparisonResult;
}

describe('Deep Mode Validation', () => {
  
  const mockComparison: UnifiedComparisonResult = {
    metadata: {
      generatedAt: new Date().toISOString(),
      model: 'gemini-3.5-flash',
      thinkingLevel: 'MEDIUM',
      pdfCount: 2,
      totalPages: 10,
      confidence: 0.85,
      needsHumanReview: false,
      processingTimeMs: 15000
    },
    client: {
      name: 'Test Client',
      activity: 'Comercio',
      address: 'Calle 123',
      city: 'Bogotá',
      totalInsuredValue: 1000000000
    },
    insurers: [
      { name: 'TestInsurer A', quoteDate: '2024-01-01', validity: '1 año', product: 'PYME' },
      { name: 'TestInsurer B', quoteDate: '2024-01-01', validity: '1 año', product: 'PYME' }
    ],
    coverageMatrix: [
      {
        category: 'INCENDIO',
        rows: [
          {
            type: 'value' as const,
            label: 'Suma Asegurada',
            cells: [
              { value: '$500.000.000', confidence: 0.9 },
              { value: '$450.000.000', confidence: 0.85 }
            ]
          },
          {
            type: 'deductible' as const,
            label: 'Deducible',
            cells: [
              { value: '10% - Ver condiciones', isAmbiguous: true },
              { value: '5% - Ver condiciones', isAmbiguous: true }
            ]
          }
        ]
      }
    ],
    financials: {
      premiums: [
        { netPremium: 5000000, fees: 500000, taxes: 1045000, total: 6545000 },
        { netPremium: 4500000, fees: 450000, taxes: 940500, total: 5890500 }
      ],
      metadata: [
        { validity: '1 año', product: 'PYME', backing: 'Reaseguro', commission: '15%' },
        { validity: '1 año', product: 'PYME', backing: 'Reaseguro', commission: '12%' }
      ]
    },
    analysis: {
      warnings: [],
      significantDifferences: []
    }
  };

  describe('validateWithClauses', () => {
    
    it('should validate comparison with clause PDFs', async () => {
      // Skip if no clause PDFs available
      const testClauseDir = './test-clauses';
      
      if (!fs.existsSync(testClauseDir)) {
        console.log('No test clause PDFs available, skipping deep mode test');
        return;
      }

      const clauseFiles = fs.readdirSync(testClauseDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .map((f: string) => `${testClauseDir}/${f}`);

      if (clauseFiles.length === 0) {
        console.log('No clause PDFs found, skipping test');
        return;
      }

      const result = await deepClauseValidator.validateWithClauses(
        mockComparison,
        clauseFiles
      );

      // Validate result structure
      expect(result).toBeDefined();
      expect(result.originalComparison).toBeDefined();
      expect(result.validatedComparison).toBeDefined();
      expect(result.validations).toBeInstanceOf(Array);
      expect(result.discrepancies).toBeInstanceOf(Array);

      console.log(`✅ Deep mode test passed: ${result.validations.length} validations, ${result.discrepancies.length} discrepancies`);

    }, 120000); // 2 minute timeout

    it('should handle empty clause files array', async () => {
      await expect(
        deepClauseValidator.validateWithClauses(mockComparison, [])
      ).rejects.toThrow();
    });

    it('should handle non-existent clause files', async () => {
      await expect(
        deepClauseValidator.validateWithClauses(mockComparison, ['/nonexistent.pdf'])
      ).rejects.toThrow();
    });

    it('should preserve original comparison in result', async () => {
      // Skip if no clause PDFs available
      const testClauseDir = './test-clauses';
      
      if (!fs.existsSync(testClauseDir)) {
        console.log('No test clause PDFs available, skipping');
        return;
      }

      const clauseFiles = fs.readdirSync(testClauseDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .map((f: string) => `${testClauseDir}/${f}`);

      if (clauseFiles.length === 0) {
        console.log('No clause PDFs found, skipping');
        return;
      }

      const result = await deepClauseValidator.validateWithClauses(
        mockComparison,
        clauseFiles
      );

      // Original should be unchanged
      expect(result.originalComparison.metadata.confidence).toBe(0.85);
      expect(result.originalComparison.insurers).toHaveLength(2);

    }, 120000);

    it('should update confidence after validation', async () => {
      const testClauseDir = './test-clauses';
      
      if (!fs.existsSync(testClauseDir)) {
        console.log('No test clause PDFs available, skipping');
        return;
      }

      const clauseFiles = fs.readdirSync(testClauseDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .map((f: string) => `${testClauseDir}/${f}`);

      if (clauseFiles.length === 0) {
        console.log('No clause PDFs found, skipping');
        return;
      }

      const result = await deepClauseValidator.validateWithClauses(
        mockComparison,
        clauseFiles
      );

      // Validated comparison should have updated confidence
      expect(result.validatedComparison.metadata.confidence).toBeGreaterThanOrEqual(
        mockComparison.metadata.confidence
      );

    }, 120000);
  });

  describe('applyValidations', () => {

    it('should apply deductible validations', () => {
      const comparison = JSON.parse(JSON.stringify(mockComparison));

      const validationResult = {
        validations: [
          {
            insurer: 'TestInsurer A',
            coverage: 'INCENDIO',
            field: 'deductible',
            originalValue: '10% - Ver condiciones',
            validatedValue: '10%',
            source: 'página 15',
            confidence: 0.95
          }
        ],
        discrepancies: []
      };

      const result = (deepClauseValidator as unknown as DeepClauseValidatorWithApply).applyValidations(
        comparison,
        validationResult
      );

      const deductibleCell = result.coverageMatrix[0].rows[1].cells[0];
      expect(deductibleCell.value).toBe('10%');
      expect(deductibleCell.isAmbiguous).toBe(false);
      expect(deductibleCell.notes).toContain('Validado contra clausulado');
      expect(result.metadata.confidence).toBeGreaterThan(comparison.metadata.confidence);
    });

    it('should handle insurer not found in validation', () => {
      const comparison = JSON.parse(JSON.stringify(mockComparison));

      const validationResult = {
        validations: [
          {
            insurer: 'NonExistent Insurer',
            coverage: 'INCENDIO',
            field: 'deductible',
            validatedValue: '5%',
            source: 'página 10',
            confidence: 0.9
          }
        ],
        discrepancies: []
      };

      expect(() =>
        (deepClauseValidator as unknown as DeepClauseValidatorWithApply).applyValidations(comparison, validationResult)
      ).not.toThrow();

      // Comparison should remain unchanged
      expect(comparison.coverageMatrix[0].rows[1].cells[0].value).toBe(
        '10% - Ver condiciones'
      );
    });
  });
});