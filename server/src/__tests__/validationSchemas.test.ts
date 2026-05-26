import { describe, it, expect } from 'vitest';
import {
  analyzeRequestSchema,
  chatRequestSchema,
  createDocumentSchema,
  listDocumentsSchema,
  analysisValidationSchema,
  deductibleRiskSchema,
  uuidSchema,
} from '../middleware/validationSchemas';

describe('Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should validate a valid UUID', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('analyzeRequestSchema', () => {
    it('should validate a valid analyze request', () => {
      const result = analyzeRequestSchema.safeParse({
        clientName: 'Test Client',
        clientProfile: {
          industry: 'Technology',
          location: 'Bogota',
          size: 'Small',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept minimal valid request', () => {
      const result = analyzeRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject clientName exceeding max length', () => {
      const result = analyzeRequestSchema.safeParse({
        clientName: 'a'.repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('chatRequestSchema', () => {
    it('should validate a valid chat request', () => {
      const result = chatRequestSchema.safeParse({
        message: 'Hello, how are you?',
        useRAG: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = chatRequestSchema.safeParse({
        message: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject message exceeding max length', () => {
      const result = chatRequestSchema.safeParse({
        message: 'a'.repeat(10001),
      });
      expect(result.success).toBe(false);
    });

    it('should require message field', () => {
      const result = chatRequestSchema.safeParse({
        useRAG: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createDocumentSchema', () => {
    it('should validate a valid document creation request', () => {
      const result = createDocumentSchema.safeParse({
        insurerName: 'Test Insurer',
        documentName: 'Test Document',
        documentType: 'CLAUSULADO_GENERAL',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid document type', () => {
      const result = createDocumentSchema.safeParse({
        insurerName: 'Test Insurer',
        documentName: 'Test Document',
        documentType: 'INVALID_TYPE',
      });
      expect(result.success).toBe(false);
    });

    it('should require insurerName', () => {
      const result = createDocumentSchema.safeParse({
        documentName: 'Test Document',
        documentType: 'CLAUSULADO_GENERAL',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('listDocumentsSchema', () => {
    it('should validate with no query params', () => {
      const result = listDocumentsSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate with isActive=true', () => {
      const result = listDocumentsSchema.safeParse({
        isActive: 'true',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it('should validate with isActive=false', () => {
      const result = listDocumentsSchema.safeParse({
        isActive: 'false',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
      }
    });
  });

  describe('analysisValidationSchema', () => {
    it('should validate a valid analysis validation request', () => {
      const result = analysisValidationSchema.safeParse({
        quote: {
          insurerName: 'Test Insurer',
          coverages: [{ name: 'Test Coverage', value: '1000000' }],
        },
        insurerName: 'Test Insurer',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing quote', () => {
      const result = analysisValidationSchema.safeParse({
        insurerName: 'Test Insurer',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deductibleRiskSchema', () => {
    it('should validate a valid deductible risk request', () => {
      const result = deductibleRiskSchema.safeParse({
        coverageName: 'Test Coverage',
        quoteDeductible: '10%',
        insuredAmount: 1000000,
      });
      expect(result.success).toBe(true);
    });

    it('should accept without insuredAmount', () => {
      const result = deductibleRiskSchema.safeParse({
        coverageName: 'Test Coverage',
        quoteDeductible: '10%',
      });
      expect(result.success).toBe(true);
    });
  });
});
