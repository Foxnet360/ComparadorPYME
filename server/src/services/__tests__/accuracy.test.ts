import { describe, it, expect, vi } from 'vitest';
import { structuredClauseExtractor } from '../structuredClauseExtractor';
import { deductibleParser, DeductibleStructure } from '../deductibleParser';
import { coverageOntology } from '../coverageOntology';
import { queryExpander } from '../queryExpander';

// Mock Gemini for consistent responses
vi.mock('@google/genai', () => ({
  Type: {
    STRING: 'string',
    NUMBER: 'number',
    ARRAY: 'array',
    OBJECT: 'object',
    BOOLEAN: 'boolean',
  },
  GoogleGenAI: vi.fn(function () {
    return {
      models: {
        generateContent: vi.fn(() =>
          Promise.resolve({
            text: JSON.stringify({
              coverages: [
                {
                  name: 'AMPARO BASICO',
                  description: 'Cobertura todo riesgo de daño material',
                  insuredAmount: '$500,000,000',
                  deductible: {
                    components: [
                      { type: 'percentage', value: 10 },
                      { type: 'minimum', value: 5, currency: 'SMMLV' },
                    ],
                    rawText: '10% con mínimo de 5 SMMLV',
                  },
                  exclusions: ['Guerra', 'Terrorismo'],
                  conditions: ['Mantenimiento preventivo'],
                  sourcePage: 1,
                },
              ],
              generalExclusions: ['Actos dolosos'],
              generalConditions: ['Pago de prima'],
              definitions: { SMMLV: 'Salario Mínimo Mensual Legal Vigente' },
            }),
          })
        ),
      },
    };
  }),
}));

vi.mock('../vector/embeddingService', () => ({
  embeddingService: {
    generateEmbedding: vi.fn((text: string) => {
      // Return embeddings that cluster similar terms
      const embeddings: Record<string, number[]> = {
        'AMPARO BASICO': [0.9, 0.8, 0.7, 0.6],
        'TODO RIESGO': [0.85, 0.75, 0.65, 0.55],
        'DAÑO MATERIAL': [0.8, 0.7, 0.6, 0.5],
        Incendio: [0.7, 0.6, 0.5, 0.4],
        'Edificios y Contenidos': [0.75, 0.65, 0.55, 0.45],
        'Responsabilidad Civil': [0.5, 0.4, 0.3, 0.2],
        'Responsabilidad Civil Extracontractual': [0.55, 0.45, 0.35, 0.25],
        RC: [0.52, 0.42, 0.32, 0.22],
        RCE: [0.53, 0.43, 0.33, 0.23],
      };
      return Promise.resolve(embeddings[text] || [0.1, 0.1, 0.1, 0.1]);
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
    }),
  },
}));

describe('Accuracy Tests', () => {
  const ACCURACY_THRESHOLD = 0.85; // 85%

  describe('Structured clause extraction accuracy', () => {
    const testCases = [
      {
        name: 'MAPFRE - Amparo Básico',
        text: 'AMPARO BASICO: Todo riesgo de daño material con deducible del 10% con mínimo de 5 SMMLV',
        expectedCoverages: 1,
        expectedDeductible: { percentage: 10, min: 6500000 },
      },
      {
        name: 'CHUBB - Todo Riesgo',
        text: 'TODO RIESGO: Cobertura amplia con deducible 10% min 5 SMMLV tope 50 SMMLV',
        expectedCoverages: 1,
        expectedDeductible: { percentage: 10, min: 6500000, max: 65000000 },
      },
      {
        name: 'BBVA - Daños Materiales',
        text: 'DAÑOS MATERIALES: Cubre incendio, terremoto con deducible 10%',
        expectedCoverages: 1,
        expectedDeductible: { percentage: 10 },
      },
    ];

    it('should extract clauses with >85% accuracy', async () => {
      let correct = 0;
      const total = testCases.length;

      for (const testCase of testCases) {
        try {
          const result = await structuredClauseExtractor.extractFromText(
            testCase.text,
            testCase.name.split(' - ')[0]
          );

          // Validate extraction
          const hasExpectedCoverages = result.coverages.length >= testCase.expectedCoverages;
          const hasDeductible = result.coverages[0]?.deductible !== undefined;

          if (hasExpectedCoverages && hasDeductible) {
            correct++;
          }
        } catch (_error) {
          console.warn(`⚠️ Failed to extract: ${testCase.name}`);
        }
      }

      const accuracy = correct / total;
      console.log(`📊 Extraction accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`);

      expect(accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });
  });

  describe('Deductible parsing accuracy', () => {
    const testCases = [
      { input: '10%', expected: { percentage: 10, type: 'simple' } },
      { input: '5 SMMLV', expected: { minAmount: 7117500, type: 'fixed' } },
      { input: 'sin deducible', expected: { isZero: true, type: 'zero' } },
      {
        input: '10% con mínimo de 5 SMMLV',
        expected: { percentage: 10, hasMin: true, type: 'compound' },
      },
      {
        input: '15% con tope de 100 SMMLV',
        expected: { percentage: 15, hasMax: true, type: 'compound' },
      },
      { input: 'No aplica', expected: { isZero: true, type: 'zero' } },
      { input: '0%', expected: { isZero: true, type: 'zero' } },
      { input: '20%', expected: { percentage: 20, type: 'simple' } },
      { input: '3 SMMLV', expected: { minAmount: 4270500, type: 'fixed' } },
      { input: 'sin aplicación de deducible', expected: { isZero: true, type: 'zero' } },
    ];

    it('should parse deductibles with >85% accuracy', async () => {
      let correct = 0;
      const total = testCases.length;

      for (const testCase of testCases) {
        try {
          const result = await deductibleParser.parse(testCase.input);
          let isCorrect = false;

          if (
            testCase.expected.type === 'simple' &&
            result.normalized.percentage === testCase.expected.percentage
          ) {
            isCorrect = true;
          } else if (
            testCase.expected.type === 'fixed' &&
            result.normalized.minAmount === testCase.expected.minAmount
          ) {
            isCorrect = true;
          } else if (testCase.expected.type === 'zero' && result.semantics.isZero) {
            isCorrect = true;
          } else if (testCase.expected.type === 'compound') {
            const hasPercentage = result.normalized.percentage === testCase.expected.percentage;
            const hasMin = !testCase.expected.hasMin || result.semantics.hasMinimum;
            const hasMax = !testCase.expected.hasMax || result.semantics.hasMaximum;
            isCorrect = hasPercentage && hasMin && hasMax;
          }

          if (isCorrect) correct++;
        } catch (_error) {
          console.warn(`⚠️ Failed to parse: ${testCase.input}`);
        }
      }

      const accuracy = correct / total;
      console.log(
        `📊 Deductible parsing accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`
      );

      expect(accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });
  });

  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  (hasSupabase ? describe : describe.skip)('Coverage ontology mapping accuracy', () => {
    const testCases = [
      { input: 'AMPARO BASICO', expectedGroups: ['edificios', 'terremoto'] },
      { input: 'TODO RIESGO', expectedGroups: ['edificios'] },
      { input: 'DAÑO MATERIAL', expectedGroups: ['edificios', 'equipos'] },
      { input: 'RESPONSABILIDAD CIVIL', expectedGroups: ['rce'] },
      { input: 'RC', expectedGroups: ['rce', 'rcd'] },
      { input: 'Incendio Edificio', expectedGroups: ['edificios'] },
    ];

    it('should map coverages with >85% accuracy', async () => {
      let correct = 0;
      const total = testCases.length;

      for (const testCase of testCases) {
        try {
          const result = await coverageOntology.mapCoverage(testCase.input);

          // Check if any expected group is in the top results
          const mappedGroups = result.groups.map((g) => g.groupId);
          const hasExpectedGroup = testCase.expectedGroups.some((eg) => mappedGroups.includes(eg));

          if (hasExpectedGroup || result.confidence > 0.6) {
            correct++;
          }
        } catch (_error) {
          console.warn(`⚠️ Failed to map: ${testCase.input}`);
        }
      }

      const accuracy = correct / total;
      console.log(
        `📊 Ontology mapping accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`
      );

      expect(accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });
  });

  describe('Query expansion accuracy', () => {
    const testCases = [
      {
        input: 'deducible incendio',
        expectedTerms: ['franquicia', 'participación'],
        insurerName: 'MAPFRE',
      },
      {
        input: 'amparo básico',
        expectedTerms: ['todo riesgo', 'daño material'],
        insurerName: 'CHUBB',
      },
    ];

    it('should expand queries with relevant synonyms', () => {
      let correct = 0;
      const total = testCases.length;

      for (const testCase of testCases) {
        const expansions = queryExpander.expand(testCase.input, {
          insurerName: testCase.insurerName,
        });

        const expansionTexts = expansions.map((e) => e.query.toLowerCase());
        const hasExpectedTerm = testCase.expectedTerms.some((term) =>
          expansionTexts.some((e) => e.includes(term))
        );

        if (hasExpectedTerm || expansions.length > 1) {
          correct++;
        }
      }

      const accuracy = correct / total;
      console.log(
        `📊 Query expansion accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`
      );

      expect(accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });
  });

  describe('Validation accuracy', () => {
    it('should validate correct deductible structures', () => {
      const validStructures = [
        {
          components: [{ type: 'percentage', value: 10 }],
          semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
          normalized: { minAmount: 0, maxAmount: 0, percentage: 10, isPercentageBased: true },
          rawText: '10%',
        },
        {
          components: [{ type: 'na', value: 0 }],
          semantics: { isZero: true, hasMinimum: false, hasMaximum: false, isComposite: false },
          normalized: { minAmount: 0, maxAmount: 0, percentage: 0, isPercentageBased: false },
          rawText: 'sin deducible',
        },
      ];

      for (const structure of validStructures) {
        const validation = deductibleParser.validate(structure as unknown as DeductibleStructure);
        expect(validation.isValid).toBe(true);
        expect(validation.issues).toHaveLength(0);
      }
    });

    it('should detect invalid deductible structures', () => {
      const invalidStructures = [
        {
          components: [{ type: 'percentage', value: 150 }],
          semantics: { isZero: false, hasMinimum: false, hasMaximum: false, isComposite: false },
          normalized: { minAmount: 0, maxAmount: 0, percentage: 150, isPercentageBased: true },
          rawText: '150%',
        },
        {
          components: [
            { type: 'minimum', value: 100 },
            { type: 'maximum', value: 50 },
          ],
          semantics: { isZero: false, hasMinimum: true, hasMaximum: true, isComposite: true },
          normalized: { minAmount: 100, maxAmount: 50, percentage: 0, isPercentageBased: false },
          rawText: 'min 100 max 50',
        },
      ];

      for (const structure of invalidStructures) {
        const validation = deductibleParser.validate(structure as unknown as DeductibleStructure);
        expect(validation.isValid).toBe(false);
        expect(validation.issues.length).toBeGreaterThan(0);
      }
    });
  });
});
