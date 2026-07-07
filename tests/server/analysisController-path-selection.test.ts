import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';

const generateComparison = vi.fn();

vi.mock('../../server/src/services/unifiedComparison/comparisonEngineAdapter', () => ({
  comparisonEngineAdapter: {
    generateComparison: (...args: unknown[]) => generateComparison(...args),
  },
}));

vi.mock('../../server/src/repositories/analysisRepository', () => ({
  saveAnalysisHistory: vi.fn(async () => null),
  getAnalysisHistoryByUser: vi.fn(async () => []),
}));

const { analysisController } = await import('../../server/src/controllers/analysisController');

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });
app.post(
  '/api/analyze',
  upload.fields([{ name: 'quotes', maxCount: 10 }]),
  analysisController.uploadAndAnalyze
);

function makeAdapterResult(engine: 'unified' | 'fallback' = 'unified') {
  return {
    matrix: [
      {
        type: 'header',
        id: 'client_info',
        label: 'Cotizaciones PYME - SBS',
        sectionId: 0,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'header',
        id: 'section_0',
        label: 'INFORMACIÓN GENERAL',
        sectionId: 1,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'section_0_row_0',
        label: 'Incendio',
        sectionId: 1,
        cells: [
          { value: '100M', isExcluded: false, isWinner: false, notes: '10%', confidence: 95 },
        ],
      },
      {
        type: 'header',
        id: 'financials',
        label: 'PRIMAS Y COSTOS',
        sectionId: 999,
        cells: [{ value: '', isExcluded: false, isWinner: false }],
      },
      {
        type: 'data',
        id: 'premium_total',
        label: 'TOTAL A PAGAR',
        sectionId: 999,
        cells: [{ value: '$5.000.000', isExcluded: false, isWinner: false }],
      },
    ],
    engine,
    correlationId: `test-${engine}-123`,
  };
}

describe('analysisController adapter integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateComparison.mockResolvedValue(makeAdapterResult('unified'));
  });

  it('uses comparison engine adapter as the single router', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('test pdf content'), 'quote-sbs.pdf');

    expect(response.status).toBe(200);
    expect(generateComparison).toHaveBeenCalledTimes(1);
    expect(response.body.quotes[0].insurerName).toBe('quote-sbs');
  });

  it('returns fallback engine metadata when adapter falls back', async () => {
    generateComparison.mockResolvedValue(makeAdapterResult('fallback'));

    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('test pdf content'), 'quote-sbs.pdf');

    expect(response.status).toBe(200);
    expect(response.body.quotes).toBeInstanceOf(Array);
    expect(response.body.quotes.length).toBeGreaterThan(0);
  });

  it('returns 500 when adapter throws', async () => {
    generateComparison.mockRejectedValue(new Error('Adapter failure'));

    const response = await request(app)
      .post('/api/analyze')
      .attach('quotes', Buffer.from('test pdf content'), 'quote-sbs.pdf');

    expect(response.status).toBe(500);
  });
});
