/**
 * Integration Test: Unified Comparison Engine
 * Tests the unified engine with the laser-home example (4 quotes)
 * 
 * Usage: npx ts-node server/src/services/unifiedComparison/__tests__/integration.test.ts
 */

import { unifiedComparisonEngine } from '../unifiedComparisonEngine';
import { comparisonEngineAdapter } from '../comparisonEngineAdapter';
import { featureFlags } from '../../../config/featureFlags';
import { setCachedUnifiedResult, getCachedUnifiedResult } from '../../cache/redisCache';
import * as fs from 'fs';
import * as path from 'path';

const TEST_TIMEOUT = 120000; // 2 minutes

// Mock feature flag for testing
featureFlags.updateFlag('useUnifiedComparisonEngine', true);

describe('Unified Comparison Engine Integration', () => {
  const testPdfDir = path.join(__dirname, '..', '..', '..', '..', '..', 'Ejemplos', 'kimi_resultados');

  // Skip tests if no test PDFs available or no Gemini API key is configured
  const hasTestPdfs = fs.existsSync(testPdfDir);
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  (hasTestPdfs && hasGeminiKey ? describe : describe.skip)('with sample quotes', () => {
    it('should process multiple quotes and return valid result', async () => {
      // Find test PDFs
      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => path.join(testPdfDir, f));
      
      if (pdfFiles.length === 0) {
        console.log('No test PDFs found, skipping test');
        return;
      }
      
      console.log(`Testing with ${pdfFiles.length} PDFs`);
      
      // Test unified engine directly
      const result = await unifiedComparisonEngine.compare(pdfFiles.slice(0, 2)); // Limit to 2 for speed
      
      // Validate structure
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.insurers).toBeInstanceOf(Array);
      expect(result.coverageMatrix).toBeInstanceOf(Array);
      expect(result.financials).toBeDefined();
      
      // Validate metadata
      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1);
      expect(result.metadata.pdfCount).toBeGreaterThan(0);
      
      // Validate insurers
      expect(result.insurers.length).toBeGreaterThan(0);
      result.insurers.forEach(insurer => {
        expect(insurer.name).toBeTruthy();
      });
      
      // Validate coverage matrix
      expect(result.coverageMatrix.length).toBeGreaterThan(0);
      result.coverageMatrix.forEach(section => {
        expect(section.category).toBeTruthy();
        expect(section.rows).toBeInstanceOf(Array);
      });
      
      console.log(`✅ Test passed: Processed ${result.insurers.length} insurers`);
      console.log(`   Confidence: ${result.metadata.confidence}`);
      console.log(`   Processing time: ${result.metadata.processingTimeMs}ms`);
      
    }, TEST_TIMEOUT);
    
    it('should transform to MatrixRow format', async () => {
      const pdfFiles = fs.readdirSync(testPdfDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => path.join(testPdfDir, f));
      
      if (pdfFiles.length === 0) {
        return;
      }
      
      // Test adapter transformation
      const adapterResult = await comparisonEngineAdapter.generateComparison(
        pdfFiles.slice(0, 2),
        'test-user'
      );
      const matrixRows = adapterResult.matrix;
      
      expect(matrixRows).toBeInstanceOf(Array);
      expect(matrixRows.length).toBeGreaterThan(0);
      expect(adapterResult.engine).toBeDefined();
      expect(adapterResult.correlationId).toBeDefined();
      
      // Validate MatrixRow structure
      const headerRow = matrixRows.find(r => r.type === 'header');
      expect(headerRow).toBeDefined();
      
      const dataRows = matrixRows.filter(r => r.type === 'data');
      expect(dataRows.length).toBeGreaterThan(0);
      
      console.log(`✅ Adapter test passed: ${matrixRows.length} matrix rows generated`);
      
    }, TEST_TIMEOUT);
  });
  
  describe('fallback mechanism', () => {
    it('should handle empty PDF array gracefully', async () => {
      await expect(unifiedComparisonEngine.compare([]))
        .rejects
        .toThrow();
    });
    
    it('should handle non-existent PDF paths', async () => {
      await expect(unifiedComparisonEngine.compare(['/nonexistent.pdf']))
        .rejects
        .toThrow();
    });
  });
  
  describe('caching', () => {
    it('should cache and retrieve results', async () => {
      const testResult = {
        metadata: { test: true },
        insurers: [],
        coverageMatrix: []
      };

      await setCachedUnifiedResult('test-hash', testResult);
      const cached = await getCachedUnifiedResult('test-hash');

      expect(cached).toBeDefined();
      expect(cached.metadata.test).toBe(true);

      console.log('✅ Cache test passed');
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running integration tests...');
  console.log('Note: These tests require valid PDF files and Gemini API key');
}