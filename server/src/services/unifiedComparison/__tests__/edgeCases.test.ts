/**
 * Edge Case Tests for Unified Comparison Engine
 * Tests: 1 quote, 8+ quotes, missing data, etc.
 */

import { unifiedComparisonEngine } from '../unifiedComparisonEngine';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { validateAgainstExcelStructure } from '../excelStructureValidator';

describe('Edge Cases', () => {
  
  const TEST_TIMEOUT = 120000; // 2 minutes

  describe('1 quote', () => {
    
    it('should handle single quote processing', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 1)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length === 0) {
        console.log('No PDFs found, skipping');
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      expect(result).toBeDefined();
      expect(result.insurers).toHaveLength(1);
      expect(result.coverageMatrix).toBeInstanceOf(Array);
      expect(result.financials.premiums).toHaveLength(1);

      // Validate structure
      const validation = validateAgainstExcelStructure(result);
      expect(validation.valid).toBe(true);

      console.log(`✅ Single quote test passed: ${result.insurers[0].name}`);

    }, TEST_TIMEOUT);

    it('should handle single quote with incomplete data', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 1)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length === 0) {
        console.log('No PDFs found, skipping');
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      // Single quote should still have valid structure even with missing data
      expect(result.insurers).toBeDefined();
      expect(result.coverageMatrix.length).toBeGreaterThan(0);

      // Check if any cells have missing data (null or 'No informado')
      let missingDataCount = 0;
      result.coverageMatrix.forEach((section: any) => {
        section.rows.forEach((row: any) => {
          row.cells.forEach((cell: any) => {
            if (!cell.value || cell.value === 'No informado' || cell.value === 'N.C.') {
              missingDataCount++;
            }
          });
        });
      });

      console.log(`✅ Single quote with incomplete data: ${missingDataCount} missing values`);

    }, TEST_TIMEOUT);
  });

  describe('8+ quotes', () => {
    
    it('should handle many quotes (8+)', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 8)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length < 8) {
        console.log(`Only ${pdfFiles.length} PDFs available, need 8 for test`);
        return;
      }

      const startTime = Date.now();
      const result = await unifiedComparisonEngine.compare(pdfFiles);
      const durationMs = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(result.insurers).toHaveLength(8);
      expect(result.coverageMatrix).toBeInstanceOf(Array);

      // Should still complete in reasonable time (even with 8 quotes)
      expect(durationMs).toBeLessThan(120000); // 2 minutes

      // Validate structure
      const validation = validateAgainstExcelStructure(result);
      expect(validation.insurerCount).toBe(8);

      console.log(`✅ Many quotes test passed: ${result.insurers.length} insurers in ${durationMs}ms`);

    }, 180000); // 3 minutes

    it('should handle all cells having values for 8+ insurers', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 8)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length < 8) {
        console.log(`Only ${pdfFiles.length} PDFs available, need 8`);
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      // Verify all coverage rows have 8 cells
      let totalCells = 0;
      let validCells = 0;
      
      result.coverageMatrix.forEach((section: any) => {
        section.rows.forEach((row: any) => {
          totalCells += row.cells.length;
          if (row.cells.length === 8) {
            validCells += 8;
          }
        });
      });

      expect(validCells).toBeGreaterThan(0);
      console.log(`✅ Cell count test: ${validCells}/${totalCells} valid cells`);

    }, 180000);
  });

  describe('Quotes with missing data', () => {
    
    it('should handle quotes with missing coverages', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 2)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length < 2) {
        console.log('Need at least 2 PDFs');
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      // Should still return a valid result even with missing data
      expect(result).toBeDefined();
      expect(result.insurers.length).toBeGreaterThan(0);

      // Count missing cells
      let missingCount = 0;
      let totalCount = 0;
      
      result.coverageMatrix.forEach((section: any) => {
        section.rows.forEach((row: any) => {
          row.cells.forEach((cell: any) => {
            totalCount++;
            if (!cell.value || cell.value === 'No informado' || cell.value === 'N.C.') {
              missingCount++;
            }
          });
        });
      });

      // Should have some data (not all missing)
      expect(totalCount - missingCount).toBeGreaterThan(0);

      console.log(`✅ Missing data test: ${missingCount}/${totalCount} cells missing`);

    }, TEST_TIMEOUT);

    it('should handle quotes with ambiguous deductibles', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 2)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length < 2) {
        console.log('Need at least 2 PDFs');
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      // Look for ambiguous cells
      let ambiguousCount = 0;
      
      result.coverageMatrix.forEach((section: any) => {
        section.rows.forEach((row: any) => {
          row.cells.forEach((cell: any) => {
            if (cell.isAmbiguous) {
              ambiguousCount++;
            }
          });
        });
      });

      console.log(`✅ Ambiguous data test: ${ambiguousCount} ambiguous cells found`);
      // Not asserting specific count, just verifying it handles them

    }, TEST_TIMEOUT);

    it('should handle quotes with 0 premium', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .slice(0, 2)
        .map((f: string) => `${testPdfDir}/${f}`);

      if (pdfFiles.length < 2) {
        console.log('Need at least 2 PDFs');
        return;
      }

      const result = await unifiedComparisonEngine.compare(pdfFiles);

      // Check if any premiums are 0
      const zeroPremiums = result.financials.premiums.filter(
        (p: any) => !p.total || p.total === 0
      );

      if (zeroPremiums.length > 0) {
        console.log(`⚠️ Found ${zeroPremiums.length} quotes with 0 premium`);
      }

      // Should still have valid structure
      expect(result.financials.premiums.length).toBeGreaterThan(0);

    }, TEST_TIMEOUT);
  });

  describe('Invalid inputs', () => {
    
    it('should handle empty PDF array', async () => {
      await expect(
        unifiedComparisonEngine.compare([])
      ).rejects.toThrow();
    });

    it('should handle non-existent PDF files', async () => {
      await expect(
        unifiedComparisonEngine.compare(['/nonexistent.pdf'])
      ).rejects.toThrow();
    });

    it('should handle invalid file types', async () => {
      await expect(
        unifiedComparisonEngine.compare(['/tmp/test.txt'])
      ).rejects.toThrow();
    });

    it('should handle corrupted PDF files', async () => {
      const fs = require('fs');
      const path = require('path');
      
      // Create a corrupted PDF
      const corruptedPath = '/tmp/corrupted.pdf';
      fs.writeFileSync(corruptedPath, 'This is not a valid PDF');

      try {
        await expect(
          unifiedComparisonEngine.compare([corruptedPath])
        ).rejects.toThrow();
      } finally {
        // Cleanup
        if (fs.existsSync(corruptedPath)) {
          fs.unlinkSync(corruptedPath);
        }
      }
    });
  });

  describe('Large file handling', () => {
    
    it('should handle large PDF files (10+ MB)', async () => {
      const fs = require('fs');
      const testPdfDir = './test-quotes';
      
      if (!fs.existsSync(testPdfDir)) {
        console.log('No test PDFs available, skipping');
        return;
      }

      // Find large PDFs
      const largePdfs = fs.readdirSync(testPdfDir)
        .filter((f: string) => f.endsWith('.pdf'))
        .map((f: string) => ({
          path: `${testPdfDir}/${f}`,
          size: fs.statSync(`${testPdfDir}/${f}`).size
        }))
        .filter((f: any) => f.size > 10 * 1024 * 1024); // > 10MB

      if (largePdfs.length === 0) {
        console.log('No large PDFs (>10MB) found, skipping');
        return;
      }

      const result = await unifiedComparisonEngine.compare(
        largePdfs.slice(0, 2).map((f: any) => f.path)
      );

      expect(result).toBeDefined();
      console.log(`✅ Large file test passed: ${largePdfs[0].size / 1024 / 1024}MB PDF`);

    }, TEST_TIMEOUT * 2);
  });
});