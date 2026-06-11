import { describe, it, expect, vi, beforeEach } from 'vitest';
import { structuredClauseExtractor, StructuredClause } from '../structuredClauseExtractor';

// Mock the database and genai
vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id-123' }, error: null }))
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: vi.fn(() => Promise.resolve({
        text: JSON.stringify({
          coverages: [
            {
              name: 'AMPARO BASICO',
              description: 'Cobertura todo riesgo',
              insuredAmount: '$500,000,000',
              deductible: {
                components: [
                  { type: 'percentage', value: 10 },
                  { type: 'minimum', value: 5, currency: 'SMMLV' }
                ],
                rawText: '10% con mínimo de 5 SMMLV'
              },
              exclusions: ['Guerra', 'Terrorismo'],
              conditions: ['Mantenimiento preventivo'],
              sourcePage: 1
            }
          ],
          generalExclusions: ['Actos dolosos'],
          generalConditions: ['Pago de prima'],
          definitions: { SMMLV: 'Salario Mínimo Mensual Legal Vigente' }
        })
      }))
    }
  }))
}));

describe('structuredClauseExtractor', () => {
  describe('extractFromText', () => {
    it('should extract structured data from clause text', async () => {
      const result = await structuredClauseExtractor.extractFromText(
        'Texto del clausulado de prueba',
        'MAPFRE',
        'PYME BASICA'
      );

      expect(result).toBeDefined();
      expect(result.insurer).toBe('MAPFRE');
      expect(result.product).toBe('PYME BASICA');
      expect(result.coverages).toHaveLength(1);
      expect(result.coverages[0].name).toBe('AMPARO BASICO');
      expect(result.coverages[0].deductible).toBeDefined();
      expect(result.coverages[0].deductible?.components).toHaveLength(2);
    });

    it('should handle empty or invalid input', async () => {
      vi.mocked(require('@google/genai').GoogleGenAI).mockImplementationOnce(() => ({
        models: {
          generateContent: vi.fn(() => Promise.resolve({
            text: 'invalid json'
          }))
        }
      }));

      await expect(
        structuredClauseExtractor.extractFromText('', 'TEST')
      ).rejects.toThrow();
    });
  });

  describe('storeStructuredClause', () => {
    it('should store structured clause in database', async () => {
      const clause: StructuredClause = {
        insurer: 'CHUBB',
        product: 'PYME PREMIUM',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      };

      const id = await structuredClauseExtractor.storeStructuredClause(clause, 'doc-123');
      expect(id).toBe('test-id-123');
    });
  });

  describe('searchClause', () => {
    it('should return null when no clause found', async () => {
      const result = await structuredClauseExtractor.searchClause('UNKNOWN_INSURER');
      expect(result).toBeNull();
    });
  });

  describe('validateExtraction', () => {
    it('should validate extraction against raw text', () => {
      const structured: StructuredClause = {
        insurer: 'BBVA',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Incendio',
            description: 'Cobertura de incendio',
            exclusions: [],
            conditions: [],
            sourcePage: 1
          }
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      };

      const rawText = 'Este documento cubre Incendio y otros riesgos';
      const validation = structuredClauseExtractor.validateExtraction(structured, rawText);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect coverage names not in raw text', () => {
      const structured: StructuredClause = {
        insurer: 'AXA',
        product: 'PYME',
        documentType: 'CLAUSULADO_GENERAL',
        coverages: [
          {
            name: 'Cobertura Inexistente',
            description: 'No existe',
            exclusions: [],
            conditions: [],
            sourcePage: 1
          }
        ],
        generalExclusions: [],
        generalConditions: [],
        definitions: {}
      };

      const rawText = 'Este documento solo cubre Incendio';
      const validation = structuredClauseExtractor.validateExtraction(structured, rawText);

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });
  });
});