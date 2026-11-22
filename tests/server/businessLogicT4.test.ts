import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const dbInsertSpy = vi.hoisted(() => vi.fn(async () => ({ data: null, error: null })));

vi.mock('../../server/src/config/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: dbInsertSpy,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));

import { analyzeDeductibleRisk } from '../../server/src/controllers/analysisValidationController';
import { deductibleAnalyzer } from '../../server/src/services/deductibleAnalyzer';
import { hybridDeductibleParser } from '../../server/src/services/hybridDeductibleParser';
import { analyticsAggregationService } from '../../server/src/services/analyticsAggregationService';
import type { ParsedQuote } from '../../server/src/services/quoteParser';

describe('T4 Business Logic Fixes (S3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('analyzeDeductibleRisk awaits deductibleAnalyzer.analyze and parses Colombian insuredAmount', async () => {
    const req = {
      body: {
        coverageName: 'Incendio',
        quoteDeductible: '10%',
        insuredAmount: '$100.000.000',
      },
    } as Request;
    const jsonMock = vi.fn();
    const statusMock = vi.fn(() => ({ json: jsonMock }));
    const res = { json: jsonMock, status: statusMock } as unknown as Response;

    await analyzeDeductibleRisk(req, res);

    expect(jsonMock).toHaveBeenCalledTimes(1);
    const payload = jsonMock.mock.calls[0][0] as {
      deductibleAmount?: number;
      riskLevel?: string;
    };
    expect(payload.riskLevel).toBeDefined();
    expect(payload.deductibleAmount).toBe(10_000_000);
  });

  it('deductibleAnalyzer.analyzeQuote parses COP decimals, M suffixes, and SMMLV without m-collision', async () => {
    const quote: ParsedQuote = {
      insurerName: 'SURA',
      totalPremium: '$5.000.000',
      coverages: [
        { name: 'Equipo Electrónico', value: '$10.500.000,50', deductible: '10%' },
        { name: 'Sustracción', value: '$5.5M', deductible: '10%' },
        { name: 'Responsabilidad Civil', value: '100 SMMLV', deductible: '10%' },
      ],
      exclusions: [],
      warranties: [],
    };

    const results = await deductibleAnalyzer.analyzeQuote(quote, new Map());
    expect(results).toHaveLength(3);
    expect(results[0]!.insuredAmount).toBeCloseTo(10_500_000.5, 2);
    expect(results[1]!.insuredAmount).toBe(5_500_000);
    expect(results[2]!.insuredAmount).toBe(100 * 1_423_500);
  });

  it('hybridDeductibleParser.parseSync handles decimal SMMLV/UVT, US $1,500.00, and comma percentages', () => {
    const smmlvDec = hybridDeductibleParser.parseSync('1.5 SMMLV');
    expect(smmlvDec.components[0]).toMatchObject({ type: 'smmlv', value: 1.5 });

    const uvtDec = hybridDeductibleParser.parseSync('2,5 UVT');
    expect(uvtDec.components[0]).toMatchObject({ type: 'uvt', value: 2.5 });

    const usFixed = hybridDeductibleParser.parseSync('$1,500.00');
    expect(usFixed.components[0]).toMatchObject({ type: 'fixed', value: 1500 });

    const compound = hybridDeductibleParser.parseSync('10,5% con mínimo de 1.5 SMMLV');
    expect(compound.components).toContainEqual({ type: 'percentage', value: 10.5 });
    expect(compound.components).toContainEqual({
      type: 'minimum',
      value: 1.5,
      currency: 'SMMLV',
    });
  });

  it('analyticsAggregationService.ingestAnalysisToDaas parses Colombian $1.500.000 prices accurately', async () => {
    await analyticsAggregationService.ingestAnalysisToDaas({
      id: 'ana-1',
      domain: 'pyme',
      created_at: '2026-11-22T00:00:00Z',
      analysis_result: {
        quotes: [
          {
            insurerName: 'SURA',
            priceAnnual: '$1.500.000',
            priceMonthly: '$125.000,50',
            coverages: [],
          },
        ],
      },
    });

    expect(dbInsertSpy).toHaveBeenCalledTimes(1);
    const inserted = (dbInsertSpy.mock.calls[0] as unknown[])[0] as {
      price_annual: number;
      price_monthly: number;
    };
    expect(inserted.price_annual).toBe(1_500_000);
    expect(inserted.price_monthly).toBeCloseTo(125_000.5, 2);
  });
});
