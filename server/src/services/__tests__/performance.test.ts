import { describe, it, expect, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { quoteParser, ParsedQuote } from '../quoteParser';
import { buildCanonicalCoverages } from '../coverageNormalizer';
import { variableComparator } from '../variableComparator';
import { quoteScorer } from '../quoteScorer';
import { hybridDeductibleParser } from '../hybridDeductibleParser';
import { queryExpander } from '../queryExpander';

// Mock external services
vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn(() =>
      Promise.resolve(
        JSON.stringify({
          coverages: Array(20)
            .fill(null)
            .map((_, i) => ({
              name: `Coverage ${i}`,
              value: `$${(i + 1) * 100}M`,
              deductible: `${(i % 10) + 5}%`,
            })),
        })
      )
    ),
  },
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(() => {
      // Simulate realistic embedding generation delay
      return new Promise((resolve) => setTimeout(() => resolve([0.1, 0.2, 0.3]), 50));
    }),
    cosineSimilarity: vi.fn(() => 0.85),
  },
}));

describe('Performance Tests', () => {
  const TARGET_TIME_MS = 120000; // 120 seconds

  describe('Quote parsing performance', () => {
    it('should parse single quote within 5 seconds', async () => {
      const start = performance.now();

      const pdfText = `
        Cotización Seguro PYME - MAPFRE
        Coberturas:
        1. Incendio: $500M - Deducible 10%
        2. Responsabilidad Civil: $1M - Sin deducible
        3. Robo: $200M - Deducible 10%
        4. Equipo Eléctrico: $300M - Deducible 10%
        5. Rotura de Maquinaria: $250M - Deducible 15%
      `;

      await quoteParser.parse(pdfText, 'MAPFRE');

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000);
    });

    it('should parse multiple quotes within 30 seconds', async () => {
      const start = performance.now();

      const quotes = ['MAPFRE', 'CHUBB', 'BBVA', 'AXA', 'SBS'];
      const pdfText = `
        Cotización Seguro PYME
        Incendio: $500M - Deducible 10%
        Responsabilidad Civil: $1M - Sin deducible
      `;

      for (const insurer of quotes) {
        await quoteParser.parse(pdfText, insurer);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Coverage normalization performance', () => {
    it('should normalize 50 coverages within 10 seconds', async () => {
      const coverages = Array(50)
        .fill(null)
        .map((_, i) => ({
          rawName: `Cobertura ${i}`,
          insuredAmount: (i + 1) * 1000000,
          deductible: `${(i % 10) + 5}%`,
          premium: (i + 1) * 100000,
        }));

      const start = performance.now();
      await buildCanonicalCoverages(coverages);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Variable comparison performance', () => {
    it('should compare 5 quotes within 15 seconds', async () => {
      const quotes = Array(5)
        .fill(null)
        .map((_, i) => ({
          insurerName: `Insurer ${i}`,
          coverages: Array(15)
            .fill(null)
            .map((_, j) => ({
              rawName: `Coverage ${j}`,
              displayName: `Coverage ${j}`,
              insuredAmount: { value: (j + 1) * 1000000, currency: 'COP', rawText: `$${j + 1}M` },
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
        }));

      const start = performance.now();
      await variableComparator.compareQuotes(quotes);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(15000);
    });
  });

  describe('Deductible parsing performance', () => {
    it('should parse 100 deductibles within 5 seconds', async () => {
      const deductibles = [
        '10%',
        '5 SMMLV',
        'sin deducible',
        '10% con mínimo de 5 SMMLV',
        '15% con tope de 100 SMMLV',
        '0%',
        '20%',
        '3 SMMLV',
        'No aplica',
        '10% min 5 SM max 50 SM',
      ];

      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        await hybridDeductibleParser.parse(deductibles[i % deductibles.length]);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Query expansion performance', () => {
    it('should expand queries within 100ms', () => {
      const start = performance.now();

      queryExpander.expand('deducible incendio', { insurerName: 'MAPFRE' });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should batch expand 50 queries within 500ms', () => {
      const queries = Array(50).fill('deducible incendio');

      const start = performance.now();
      queryExpander.expandBatch(queries);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });

  describe('Scoring performance', () => {
    it('should score quote within 2 seconds', async () => {
      const quote = {
        insurerName: 'MAPFRE',
        coverages: Array(20)
          .fill(null)
          .map((_, i) => ({
            name: `Coverage ${i}`,
            canonicalName: `Coverage ${i}`,
            value: `$${(i + 1) * 100}M`,
            deductible: `${(i % 10) + 5}%`,
            premium: (i + 1) * 100000,
          })),
        priceAnnual: 20000000,
      };

      const start = performance.now();
      await quoteScorer.calculateScore(
        quote as unknown as ParsedQuote,
        [],
        [quote as unknown as ParsedQuote]
      );
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Complete analysis pipeline', () => {
    it('should complete full analysis within 120 seconds', async () => {
      const start = performance.now();

      // Simulate full analysis pipeline
      const quotes = ['MAPFRE', 'CHUBB'];
      const allQuotes = [];

      for (const insurer of quotes) {
        // Parse
        const parsed = await quoteParser.parse(`Cotización ${insurer}`, insurer);

        // Normalize
        const normalized = await buildCanonicalCoverages(
          parsed.coverages.map((c: { name: string }) => ({
            rawName: c.name,
            insuredAmount: 1000000,
            deductible: '10%',
            premium: 1000000,
          }))
        );

        allQuotes.push({
          insurerName: insurer,
          coverages: normalized.canonicalCoverages,
          priceAnnual: 10000000,
        });
      }

      // Compare
      await variableComparator.compareQuotes(
        allQuotes.map((q) => ({
          insurerName: q.insurerName,
          coverages: q.coverages.map((c: { name: string }) => ({
            rawName: c.name,
            displayName: c.name,
            insuredAmount: { value: 1000000, currency: 'COP', rawText: '$1M' },
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

      // Score
      for (const quote of allQuotes) {
        await quoteScorer.calculateScore(
          quote as unknown as ParsedQuote,
          [],
          allQuotes as unknown as ParsedQuote[]
        );
      }

      const duration = performance.now() - start;
      console.log(`⏱️ Full analysis duration: ${(duration / 1000).toFixed(2)}s`);

      expect(duration).toBeLessThan(TARGET_TIME_MS);
    });
  });
});
