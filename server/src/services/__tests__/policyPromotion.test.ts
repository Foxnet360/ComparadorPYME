import { describe, it, expect } from 'vitest';

/**
 * renovacion-polizas PR-2 / task 1.9 — quote→policy promotion mapping (Q4).
 * Pure-function unit tests: no mocks needed (extract-before-mock).
 *
 * Auto-carried from the winning quote: insurer, premium, coverages,
 * deductibles, ramo, source_analysis_id. Broker MUST confirm: client_id,
 * policy_number, start_date, end_date, and the per-ramo insured object.
 * provenance is recorded as 'analysis' (R1.3).
 */

import { buildPromotedPolicyInput, PromoteError } from '../policyPromotion';
import type { AnalysisHistoryRecord } from '../../repositories/analysisRepository';

const ANALYSIS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

function makeAnalysis(overrides: Partial<AnalysisHistoryRecord> = {}): AnalysisHistoryRecord {
  return {
    id: ANALYSIS_ID,
    user_id: 'user-a',
    domain: 'autos',
    analysis_result: {
      quotes: [
        {
          insurerName: 'Seguros Bolívar',
          policyName: 'Autos Plus',
          priceMonthly: 200000,
          priceAnnual: 2400000,
          currency: 'COP',
          deductibles: '10% mínimo 1 SMMLV',
          coverages: [
            { name: 'RCE', value: '100M', deductible: '10%' },
            { name: 'Todo Riesgo', value: 'Valor comercial' },
          ],
          alerts: [],
          scoringBreakdown: {},
          clientAnalysis: '',
          technicalAnalysis: '',
          score: 85,
        },
        {
          insurerName: 'SBS',
          policyName: 'Autos Básico',
          priceMonthly: 150000,
          priceAnnual: 1800000,
          currency: 'COP',
          deductibles: '5%',
          coverages: [{ name: 'RCE', value: '50M' }],
          alerts: [],
          scoringBreakdown: {},
          clientAnalysis: '',
          technicalAnalysis: '',
          score: 70,
        },
      ],
    },
    ...overrides,
  } as AnalysisHistoryRecord;
}

function makeConfirmations(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> & { insured: Record<string, unknown> } {
  return {
    client_id: CLIENT_ID,
    policy_number: 'POL-999',
    start_date: '2026-02-01',
    end_date: '2027-02-01',
    insured: { plate: 'ABC123', model: 'Mazda 3 2022', value: 90000000 },
    ...overrides,
  } as ReturnType<typeof makeConfirmations>;
}

describe('buildPromotedPolicyInput (Q4 promotion mapping)', () => {
  it('auto-carries quote fields and applies broker confirmations', () => {
    const input = buildPromotedPolicyInput(makeAnalysis(), 0, makeConfirmations());

    expect(input.client_id).toBe(CLIENT_ID);
    expect(input.ramo).toBe('autos');
    expect(input.insurer).toBe('Seguros Bolívar');
    expect(input.premium).toBe(2400000);
    expect(input.coverages).toHaveLength(2);
    expect(input.policy_number).toBe('POL-999');
    expect(input.start_date).toBe('2026-02-01');
    expect(input.end_date).toBe('2027-02-01');
    expect(input.provenance).toBe('analysis');
    expect(input.source_analysis_id).toBe(ANALYSIS_ID);
    expect(input.ramo_details).toEqual({
      insured: { plate: 'ABC123', model: 'Mazda 3 2022', value: 90000000 },
    });
  });

  it('promotes a different quote when quote_index selects it (triangulation)', () => {
    const input = buildPromotedPolicyInput(makeAnalysis(), 1, makeConfirmations());
    expect(input.insurer).toBe('SBS');
    expect(input.premium).toBe(1800000);
    expect(input.coverages).toHaveLength(1);
  });

  it('derives deductibles only from coverages that declare one', () => {
    const input = buildPromotedPolicyInput(makeAnalysis(), 0, makeConfirmations());
    expect(input.deductibles).toEqual([{ coverage: 'RCE', deductible: '10%' }]);
  });

  it('rejects an out-of-range quote_index', () => {
    expect(() => buildPromotedPolicyInput(makeAnalysis(), 5, makeConfirmations())).toThrow(
      PromoteError
    );
  });

  it('rejects an analysis without quotes', () => {
    const analysis = makeAnalysis({ analysis_result: { quotes: [] } });
    expect(() => buildPromotedPolicyInput(analysis, 0, makeConfirmations())).toThrow(/no quotes/i);
  });

  it('rejects an unsupported ramo from the analysis domain', () => {
    const analysis = makeAnalysis({ domain: 'ovni' });
    expect(() => buildPromotedPolicyInput(analysis, 0, makeConfirmations())).toThrow(/ramo/i);
  });

  it('requires the per-ramo insured object (autos: plate/model/value)', () => {
    const confirmations = makeConfirmations({ insured: { plate: 'ABC123' } });
    expect(() => buildPromotedPolicyInput(makeAnalysis(), 0, confirmations)).toThrow(/model/);
  });

  it('requires headcount and carencias date for salud', () => {
    const analysis = makeAnalysis({ domain: 'salud' });
    const confirmations = makeConfirmations({ insured: { headcount: 12 } });
    expect(() => buildPromotedPolicyInput(analysis, 0, confirmations)).toThrow(/carencias_date/);
  });

  it('requires contract for cumplimiento and address for hogar', () => {
    const cumplimiento = makeAnalysis({ domain: 'cumplimiento' });
    expect(() =>
      buildPromotedPolicyInput(cumplimiento, 0, makeConfirmations({ insured: {} }))
    ).toThrow(/contract/);

    const hogar = makeAnalysis({ domain: 'hogar' });
    expect(() => buildPromotedPolicyInput(hogar, 0, makeConfirmations({ insured: {} }))).toThrow(
      /address/
    );

    // Positive control: with the required field present, promotion succeeds.
    const ok = buildPromotedPolicyInput(
      hogar,
      0,
      makeConfirmations({ insured: { address: 'Calle 1 # 2-3' } })
    );
    expect(ok.ramo).toBe('hogar');
  });
});
