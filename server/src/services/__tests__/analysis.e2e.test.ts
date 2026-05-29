import { describe, it, expect, vi, beforeAll } from 'vitest';
import { analysisController } from '../../controllers/analysisController';
import { quoteParser } from '../quoteParser';
import { coverageNormalizer } from '../coverageNormalizer';
import { variableComparator } from '../variableComparator';
import { crossReferenceEngine } from '../crossReferenceEngine';
import { quoteScorer } from '../quoteScorer';
import { structuredClauseExtractor } from '../structuredClauseExtractor';
import { deductibleParser } from '../deductibleParser';
import chatService from '../chatService';

// Mock external services
vi.mock('../gemini', () => ({
  geminiService: {
    extractText: vi.fn(() => Promise.resolve(JSON.stringify({
      coverages: [
        { name: 'Incendio', value: '$500M', deductible: '10%' },
        { name: 'Responsabilidad Civil', value: '$1M', deductible: 'No aplica' }
      ]
    })))
  }
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn(() => Promise.resolve([0.1, 0.2, 0.3])),
    cosineSimilarity: vi.fn(() => 0.85)
  }
}));

vi.mock('../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}));

describe('End-to-End Analysis Flow', () => {
  const mockQuotes = [
    {
      insurerName: 'MAPFRE',
      pdfText: 'Cotización MAPFRE\nIncendio: $500M - Deducible 10%\nResponsabilidad Civil: $1M - Sin deducible',
      coverages: [
        { name: 'Incendio', value: '$500M', deductible: '10%', premium: 2500000 },
        { name: 'Responsabilidad Civil', value: '$1M', deductible: 'No aplica', premium: 800000 }
      ]
    },
    {
      insurerName: 'CHUBB',
      pdfText: 'Cotización CHUBB\nTodo Riesgo: $450M - Deducible 10% min 5 SMMLV\nResponsabilidad Civil: $1M - Sin deducible',
      coverages: [
        { name: 'Todo Riesgo', value: '$450M', deductible: '10% min 5 SMMLV', premium: 2800000 },
        { name: 'Responsabilidad Civil', value: '$1M', deductible: 'No aplica', premium: 750000 }
      ]
    }
  ];

  describe('Complete analysis pipeline', () => {
    it('should parse quotes from PDF text', async () => {
      for (const quote of mockQuotes) {
        const parsed = await quoteParser.parse(quote.pdfText, quote.insurerName);
        expect(parsed).toBeDefined();
        expect(parsed.insurerName).toBe(quote.insurerName);
        expect(parsed.coverages.length).toBeGreaterThan(0);
      }
    });

    it('should normalize coverages using ontology', async () => {
      const rawCoverages = mockQuotes[0].coverages.map(c => ({
        rawName: c.name,
        insuredAmount: parseInt(c.value.replace(/[^0-9]/g, '')),
        deductible: c.deductible,
        premium: c.premium
      }));

      const normalized = await coverageNormalizer.buildCanonicalCoverages(rawCoverages);
      
      expect(normalized.canonicalCoverages.length).toBeGreaterThan(0);
      expect(normalized.totalConfidence).toBeGreaterThan(0);
    });

    it('should compare variables across quotes', async () => {
      const quotesForComparison = mockQuotes.map(q => ({
        insurerName: q.insurerName,
        coverages: q.coverages.map(c => ({
          rawName: c.name,
          displayName: c.name,
          insuredAmount: { value: parseInt(c.value.replace(/[^0-9]/g, '')), currency: 'COP', rawText: c.value },
          deductible: {
            components: [{ type: 'percentage', value: 10 }],
            normalized: { minAmount: 0, maxAmount: Infinity, percentage: 10, isPercentageBased: true },
            rawText: c.deductible
          },
          exclusions: [],
          conditions: []
        }))
      }));

      const comparisons = await variableComparator.compareQuotes(quotesForComparison);
      
      expect(comparisons.length).toBeGreaterThan(0);
      
      // Should identify differences in insured amounts
      const amparoComparison = comparisons.find(c => 
        c.groupName.toLowerCase().includes('edificio') ||
        c.groupName.toLowerCase().includes('riesgo')
      );
      
      if (amparoComparison) {
        expect(amparoComparison.variables.length).toBe(2); // Both quotes have it
      }
    });

    it('should score quotes comprehensively', async () => {
      const parsedQuotes = mockQuotes.map(q => ({
        insurerName: q.insurerName,
        coverages: q.coverages.map(c => ({
          name: c.name,
          canonicalName: c.name,
          value: c.value,
          deductible: c.deductible,
          premium: c.premium
        })),
        priceAnnual: q.coverages.reduce((sum, c) => sum + c.premium, 0)
      }));

      const crossRefs: any[] = []; // Empty for basic scoring
      
      for (const quote of parsedQuotes) {
        const score = await quoteScorer.calculateScore(
          quote as any,
          crossRefs,
          parsedQuotes as any
        );
        
        expect(score.totalScore).toBeGreaterThanOrEqual(0);
        expect(score.totalScore).toBeLessThanOrEqual(100);
        expect(score.breakdown).toBeDefined();
      }
    });

    it('should handle structured clause extraction', async () => {
      const clauseText = `
        AMPARO BASICO - TODO RIESGO
        Cobertura de daño material con deducible del 10%
        con mínimo de 5 SMMLV y tope de 50 SMMLV.
        Exclusiones: Guerra, terrorismo nuclear.
      `;

      const extracted = await structuredClauseExtractor.extractFromText(
        clauseText,
        'MAPFRE',
        'PYME BASICA'
      );

      expect(extracted).toBeDefined();
      expect(extracted.insurer).toBe('MAPFRE');
      expect(extracted.coverages.length).toBeGreaterThan(0);
    });

    it('should parse deductibles correctly', async () => {
      const testCases = [
        { text: '10%', expectedPercentage: 10 },
        { text: '5 SMMLV', expectedMin: 6500000 },
        { text: 'sin deducible', expectedZero: true }
      ];

      for (const testCase of testCases) {
        const result = await deductibleParser.parse(testCase.text);
        
        if (testCase.expectedPercentage) {
          expect(result.normalized.percentage).toBe(testCase.expectedPercentage);
        }
        if (testCase.expectedMin) {
          expect(result.normalized.minAmount).toBe(testCase.expectedMin);
        }
        if (testCase.expectedZero) {
          expect(result.semantics.isZero).toBe(true);
        }
      }
    });
  });

  describe('Chat integration', () => {
    it('should answer questions using quote data', async () => {
      const reportContext = {
        quotes: [
          {
            insurerName: 'MAPFRE',
            coverages: [
              { name: 'Incendio', value: '$500M', deductible: '10%' }
            ]
          }
        ]
      };

      const response = await chatService.sendMessage(
        '¿Cuál es el deducible de incendio?',
        [],
        reportContext
      );

      expect(response.text).toBeTruthy();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle empty quotes gracefully', async () => {
      const emptyQuote = {
        insurerName: 'TEST',
        coverages: [],
        priceAnnual: 0
      };

      const score = await quoteScorer.calculateScore(
        emptyQuote as any,
        [],
        [emptyQuote as any]
      );

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.coverage).toBe(0);
    });

    it('should handle missing coverage data', async () => {
      const incompleteQuote = {
        insurerName: 'TEST',
        coverages: [
          { name: 'Unknown Coverage', value: '', deductible: '', premium: 0 }
        ],
        priceAnnual: 0
      };

      const score = await quoteScorer.calculateScore(
        incompleteQuote as any,
        [],
        [incompleteQuote as any]
      );

      expect(score).toBeDefined();
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});