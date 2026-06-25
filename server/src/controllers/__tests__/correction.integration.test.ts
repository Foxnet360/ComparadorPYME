import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { saveCorrection } from '../../controllers/analysisValidationController';

// Mock learningEngine
vi.mock('../../services/learningEngine', () => ({
  learningEngine: {
    saveCorrection: vi.fn().mockResolvedValue('test-correction-id'),
  },
}));

// Mock supabase
vi.mock('../../config/database', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
        }),
      }),
    }),
  },
}));

const app = express();
app.use(express.json());
app.post('/api/analysis/correction', saveCorrection);

describe('POST /api/analysis/correction', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should validate required fields', async () => {
    const response = await request(app)
      .post('/api/analysis/correction')
      .send({ rawName: 'Test' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeDefined();
  });

  it('should accept correction with all fields', async () => {
    const correction = {
      rawName: 'Incendio Edificio',
      insurerName: 'Seguros Mundial',
      systemMapping: 'Incendio (Edificio y Contenidos)',
      userCorrection: 'Incendio (Edificio y Contenidos)',
      correctionType: 'coverage_mapping',
      quoteId: 'quote-123',
      rawTextSnippet: 'El asegurador cubre daños por incendio',
      aiJustification: 'Match basado en embeddings',
      pageNumber: 3,
    };

    const response = await request(app)
      .post('/api/analysis/correction')
      .send(correction);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
  });

  it('should handle idempotency with correctionId', async () => {
    const correctionId = 'unique-correction-id';
    
    // Mock que la corrección ya existe
    const { supabase } = await import('../../config/database');
    (supabase.from as any).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ 
            data: { id: correctionId }, 
            error: null 
          }),
        }),
      }),
    });

    const response = await request(app)
      .post('/api/analysis/correction')
      .send({
        correctionId,
        rawName: 'Test',
        insurerName: 'Test Insurer',
        systemMapping: 'Test Mapping',
        userCorrection: 'Corrected',
      });

    expect(response.status).toBe(200);
    expect(response.body.cached).toBe(true);
  });

  it('should reject invalid correction types', async () => {
    const response = await request(app)
      .post('/api/analysis/correction')
      .send({
        rawName: 'Test',
        insurerName: 'Test',
        systemMapping: 'Test',
        userCorrection: 'Corrected',
        correctionType: 'invalid_type',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('should reject oversized snippets', async () => {
    const longSnippet = 'a'.repeat(2001);
    
    const response = await request(app)
      .post('/api/analysis/correction')
      .send({
        rawName: 'Test',
        insurerName: 'Test',
        systemMapping: 'Test',
        userCorrection: 'Corrected',
        rawTextSnippet: longSnippet,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});
