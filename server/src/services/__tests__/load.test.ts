import { describe, it, expect, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { quoteParser, ParsedQuote } from '../quoteParser';
import { buildCanonicalCoverages } from '../coverageNormalizer';
import { variableComparator } from '../variableComparator';
import { quoteScorer } from '../quoteScorer';
import { hybridDeductibleParser } from '../hybridDeductibleParser';

// Mock external services with realistic delays
vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                JSON.stringify({
                  coverages: [
                    { name: 'Incendio', value: '$500M', deductible: '10%' },
                    { name: 'Responsabilidad Civil', value: '$1M', deductible: 'No aplica' },
                  ],
                })
              ),
            100
          )
        )
    ),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve([0.1, 0.2, 0.3]), 50))
    ),
    cosineSimilarity: vi.fn(() => 0.85),
  },
}));

vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: { id: 'test-id' }, error: null }), 20)
          )
      ),
      select: vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [], error: null }), 10))
      ),
      upsert: vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: null, error: null }), 20))
      ),
      rpc: vi.fn(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: [], error: null }), 30))
      ),
    })),
  },
}));

describe('Load Tests', () => {
  const CONCURRENT_REQUESTS = 10;
  const MAX_RESPONSE_TIME_MS = 30000; // 30 seconds for concurrent requests

  describe('Concurrent quote parsing', () => {
    it('should handle 10 concurrent quote parsing requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map((_, i) => ({
          insurerName: `Insurer ${i}`,
          pdfText: `Cotización ${i}\nIncendio: $${(i + 1) * 100}M - Deducible ${(i % 10) + 5}%\nRC: $1M - Sin deducible`,
        }));

      const start = performance.now();

      const results = await Promise.all(
        requests.map((req) => quoteParser.parse(req.pdfText, req.insurerName))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(CONCURRENT_REQUESTS);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS);

      console.log(`⏱️ ${CONCURRENT_REQUESTS} concurrent parses: ${(duration / 1000).toFixed(2)}s`);
    }, 30000);
  });

  describe('Concurrent coverage normalization', () => {
    it('should handle 10 concurrent normalization requests', async () => {
      const requests = Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map((_, _i) =>
          Array(20)
            .fill(null)
            .map((_, j) => ({
              rawName: `Cobertura ${j}`,
              insuredAmount: (j + 1) * 1000000,
              deductible: `${(j % 10) + 5}%`,
              premium: (j + 1) * 100000,
            }))
        );

      const start = performance.now();

      const results = await Promise.all(
        requests.map((coverages) => buildCanonicalCoverages(coverages))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(CONCURRENT_REQUESTS);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS);

      console.log(
        `⏱️ ${CONCURRENT_REQUESTS} concurrent normalizations: ${(duration / 1000).toFixed(2)}s`
      );
    }, 30000);
  });

  describe('Concurrent variable comparison', () => {
    it('should handle 5 concurrent comparison requests with 5 quotes each', async () => {
      const requests = Array(5)
        .fill(null)
        .map(() =>
          Array(5)
            .fill(null)
            .map((_, i) => ({
              insurerName: `Insurer ${i}`,
              coverages: Array(15)
                .fill(null)
                .map((_, j) => ({
                  rawName: `Coverage ${j}`,
                  displayName: `Coverage ${j}`,
                  insuredAmount: {
                    value: (j + 1) * 1000000,
                    currency: 'COP',
                    rawText: `$${j + 1}M`,
                  },
                  deductible: {
                    components: [{ type: 'percentage', value: 10 }],
                    normalized: {
                      minAmount: 0,
                      maxAmount: Infinity,
                      percentage: 10,
                      isPercentageBased: true,
                    },
                    rawText: '10%',
                  },
                  exclusions: [],
                  conditions: [],
                })),
            }))
        );

      const start = performance.now();

      const results = await Promise.all(
        requests.map((quotes) => variableComparator.compareQuotes(quotes))
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS);

      console.log(`⏱️ 5 concurrent comparisons (5 quotes each): ${(duration / 1000).toFixed(2)}s`);
    }, 30000);
  });

  describe('Concurrent deductible parsing', () => {
    it('should handle 50 concurrent deductible parsing requests', async () => {
      const deductibles = Array(50)
        .fill(null)
        .map(
          (_, i) =>
            [
              '10%',
              '5 SMMLV',
              'sin deducible',
              '10% con mínimo de 5 SMMLV',
              '15% con tope de 100 SMMLV',
              '0%',
              '20%',
              '3 SMMLV',
              'No aplica',
              'sin aplicación de deducible',
            ][i % 10]
        );

      const start = performance.now();

      const results = await Promise.all(deductibles.map((d) => hybridDeductibleParser.parse(d)));

      const duration = performance.now() - start;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`⏱️ 50 concurrent deductible parses: ${(duration / 1000).toFixed(2)}s`);
    }, 20000);
  });

  describe('Concurrent scoring', () => {
    it('should handle 20 concurrent scoring requests', async () => {
      const quotes = Array(20)
        .fill(null)
        .map((_, i) => ({
          insurerName: `Insurer ${i}`,
          coverages: Array(20)
            .fill(null)
            .map((_, j) => ({
              name: `Coverage ${j}`,
              canonicalName: `Coverage ${j}`,
              value: `$${(j + 1) * 100}M`,
              deductible: `${(j % 10) + 5}%`,
              premium: (j + 1) * 100000,
            })),
          priceAnnual: (i + 1) * 10000000,
        }));

      const start = performance.now();

      const results = await Promise.all(
        quotes.map((quote) =>
          quoteScorer.calculateScore(
            quote as unknown as ParsedQuote,
            [],
            quotes as unknown as ParsedQuote[]
          )
        )
      );

      const duration = performance.now() - start;

      expect(results).toHaveLength(20);
      expect(duration).toBeLessThan(MAX_RESPONSE_TIME_MS);

      console.log(`⏱️ 20 concurrent scoring requests: ${(duration / 1000).toFixed(2)}s`);
    }, 30000);
  });

  describe('Memory usage under load', () => {
    it('should handle large batch processing without memory issues', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Process 100 quotes
      const quotes = Array(100)
        .fill(null)
        .map((_, i) => ({
          insurerName: `Insurer ${i}`,
          coverages: Array(10)
            .fill(null)
            .map((_, j) => ({
              name: `Coverage ${j}`,
              canonicalName: `Coverage ${j}`,
              value: `$${(j + 1) * 100}M`,
              deductible: '10%',
              premium: (j + 1) * 100000,
            })),
          priceAnnual: 10000000,
        }));

      for (const quote of quotes) {
        await quoteScorer.calculateScore(
          quote as unknown as ParsedQuote,
          [],
          [quote as unknown as ParsedQuote]
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`💾 Memory increase: ${memoryIncrease.toFixed(2)}MB`);

      // Should not increase by more than 100MB
      expect(memoryIncrease).toBeLessThan(100);
    }, 30000);
  });

  describe('Stress test', () => {
    it('should handle burst of 100 rapid requests', async () => {
      const start = performance.now();

      const promises = Array(100)
        .fill(null)
        .map((_, i) => hybridDeductibleParser.parse(`${(i % 20) + 1}%`));

      const results = await Promise.all(promises);
      const duration = performance.now() - start;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

      console.log(`⏱️ 100 rapid requests: ${(duration / 1000).toFixed(2)}s`);
    }, 20000);
  });
});
