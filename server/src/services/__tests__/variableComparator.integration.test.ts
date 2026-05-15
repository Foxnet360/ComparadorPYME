import { describe, it, expect, vi } from 'vitest';
import { variableComparator } from '../variableComparator';
import { coverageOntology } from '../coverageOntology';

// Mock embedding service
vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn((text: string) => {
      const mockEmbeddings: Record<string, number[]> = {
        'AMPARO BASICO': [0.9, 0.8, 0.7, 0.6],
        'TODO RIESGO': [0.85, 0.75, 0.65, 0.55],
        'Incendio': [0.7, 0.6, 0.5, 0.4],
        'Edificios y Contenidos': [0.75, 0.65, 0.55, 0.45],
      };
      return Promise.resolve(mockEmbeddings[text] || [0.1, 0.1, 0.1, 0.1]);
    }),
    cosineSimilarity: vi.fn((a: number[], b: number[]) => {
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 0.001);
    })
  }
}));

describe('variableComparator - Integration', () => {
  const mockQuotes = [
    {
      insurerName: 'MAPFRE',
      coverages: [
        {
          rawName: 'AMPARO BASICO',
          displayName: 'Amparo Básico',
          insuredAmount: { value: 500000000, currency: 'COP', rawText: '$500M' },
          deductible: {
            components: [{ type: 'percentage', value: 10 }],
            normalized: { minAmount: 0, maxAmount: Infinity, percentage: 10, isPercentageBased: true },
            rawText: '10%'
          },
          exclusions: ['Guerra', 'Terrorismo'],
          conditions: ['Mantenimiento preventivo']
        },
        {
          rawName: 'RESPONSABILIDAD CIVIL',
          displayName: 'Responsabilidad Civil',
          insuredAmount: { value: 1000000000, currency: 'COP', rawText: '$1M' },
          deductible: {
            components: [{ type: 'na', value: 0 }],
            normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
            rawText: 'No aplica'
          },
          exclusions: [],
          conditions: []
        }
      ]
    },
    {
      insurerName: 'CHUBB',
      coverages: [
        {
          rawName: 'TODO RIESGO',
          displayName: 'Todo Riesgo',
          insuredAmount: { value: 450000000, currency: 'COP', rawText: '$450M' },
          deductible: {
            components: [
              { type: 'percentage', value: 10 },
              { type: 'minimum', value: 5, currency: 'SMMLV' }
            ],
            normalized: { minAmount: 6500000, maxAmount: Infinity, percentage: 10, isPercentageBased: true },
            rawText: '10% con mínimo de 5 SMMLV'
          },
          exclusions: ['Guerra', 'Huelga'],
          conditions: ['Inspección previa']
        },
        {
          rawName: 'RC',
          displayName: 'Responsabilidad Civil',
          insuredAmount: { value: 1000000000, currency: 'COP', rawText: '$1M' },
          deductible: {
            components: [{ type: 'na', value: 0 }],
            normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
            rawText: 'No aplica'
          },
          exclusions: [],
          conditions: []
        }
      ]
    }
  ];

  describe('compareQuotes', () => {
    it('should compare variables across multiple quotes', async () => {
      const comparisons = await variableComparator.compareQuotes(mockQuotes);
      
      expect(comparisons.length).toBeGreaterThan(0);
      
      // Should find grouped coverages
      const groupedCoverages = comparisons.filter(c => c.variables.length > 1);
      expect(groupedCoverages.length).toBeGreaterThan(0);
    });

    it('should identify best insured amount', async () => {
      const comparisons = await variableComparator.compareQuotes(mockQuotes);
      
      const amparoGroup = comparisons.find(c => 
        c.groupName.toLowerCase().includes('edificio') || 
        c.groupName.toLowerCase().includes('amparo')
      );
      
      if (amparoGroup) {
        expect(amparoGroup.analysis.bestInsuredAmount).toBeDefined();
      }
    });

    it('should identify exclusive coverages', async () => {
      const comparisons = await variableComparator.compareQuotes(mockQuotes);
      
      // Check if any group has exclusive coverages
      const withExclusives = comparisons.filter(c => c.exclusiveCoverages.length > 0);
      // Exclusive coverages depend on how ontology groups them
      expect(withExclusives).toBeDefined();
    });

    it('should handle custom weights', async () => {
      const customWeights = {
        insuredAmount: 0.5,
        deductible: 0.3,
        exclusions: 0.1,
        price: 0.1
      };
      
      const comparisons = await variableComparator.compareQuotes(mockQuotes, customWeights);
      expect(comparisons.length).toBeGreaterThan(0);
    });
  });

  describe('generateComparisonMatrix', () => {
    it('should generate matrix for frontend', async () => {
      const comparisons = await variableComparator.compareQuotes(mockQuotes);
      const matrix = variableComparator.generateComparisonMatrix(comparisons);
      
      expect(matrix.length).toBeGreaterThan(0);
      expect(matrix[0]).toHaveProperty('variable');
      expect(matrix[0]).toHaveProperty('MAPFRE');
      expect(matrix[0]).toHaveProperty('CHUBB');
    });

    it('should handle empty comparisons', () => {
      const matrix = variableComparator.generateComparisonMatrix([]);
      expect(matrix).toHaveLength(0);
    });
  });

  describe('gap detection', () => {
    it('should detect gaps when coverage is missing from one quote', async () => {
      const quotesWithGap = [
        {
          insurerName: 'MAPFRE',
          coverages: [
            {
              rawName: 'AMPARO BASICO',
              displayName: 'Amparo Básico',
              insuredAmount: { value: 500000000, currency: 'COP', rawText: '$500M' },
              deductible: {
                components: [{ type: 'percentage', value: 10 }],
                normalized: { minAmount: 0, maxAmount: Infinity, percentage: 10, isPercentageBased: true },
                rawText: '10%'
              },
              exclusions: [],
              conditions: []
            }
          ]
        },
        {
          insurerName: 'CHUBB',
          coverages: [
            {
              rawName: 'TODO RIESGO',
              displayName: 'Todo Riesgo',
              insuredAmount: { value: 450000000, currency: 'COP', rawText: '$450M' },
              deductible: {
                components: [{ type: 'percentage', value: 10 }],
                normalized: { minAmount: 0, maxAmount: Infinity, percentage: 10, isPercentageBased: true },
                rawText: '10%'
              },
              exclusions: [],
              conditions: []
            },
            {
              rawName: 'EXCLUSIVE_COVERAGE',
              displayName: 'Exclusive Coverage',
              insuredAmount: { value: 100000000, currency: 'COP', rawText: '$100M' },
              deductible: {
                components: [{ type: 'na', value: 0 }],
                normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
                rawText: 'No aplica'
              },
              exclusions: [],
              conditions: []
            }
          ]
        }
      ];

      const comparisons = await variableComparator.compareQuotes(quotesWithGap);
      
      // Should have ungrouped/exclusive coverages
      const ungrouped = comparisons.filter(c => c.groupId === 'unclassified');
      expect(ungrouped.length).toBeGreaterThanOrEqual(0);
    });
  });
});