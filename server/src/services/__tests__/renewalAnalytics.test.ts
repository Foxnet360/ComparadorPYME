/**
 * Renewal analytics tests (task 1.13, spec R2.3/R2.4/R2.5).
 *
 * Pure functions over the baseline (incumbent) quote and candidate quotes:
 * gap analysis (coverages lost/gained, deductible worsening, new
 * exclusions), premium delta vs baseline, and the per-ramo switching-friction
 * registry.
 */

import { describe, it, expect } from 'vitest';
import {
  computeGapAnalysis,
  computePremiumDelta,
  computeRenewalAnalytics,
  getFrictionNotes,
  FRICTION_REGISTRY,
  RenewalQuoteShape,
} from '../renewalAnalytics';

function quote(overrides: Partial<RenewalQuoteShape> = {}): RenewalQuoteShape {
  return {
    insurerName: 'Baseline Seguros',
    priceAnnual: 8_500_000,
    coverages: [
      { name: 'Incendio', value: '500M', deductible: '10%' },
      { name: 'Responsabilidad Civil', value: '100M', deductible: '5%' },
      { name: 'Robo', value: '200M', deductible: '10%' },
    ],
    ...overrides,
  };
}

describe('computeGapAnalysis (R2.3)', () => {
  it('detects coverages lost and gained vs the baseline', () => {
    const baseline = quote();
    const candidate = quote({
      insurerName: 'MAPFRE',
      coverages: [
        { name: 'Incendio', value: '600M', deductible: '10%' },
        { name: 'Responsabilidad Civil', value: '100M', deductible: '5%' },
        // Robo is gone → lost
        { name: 'Terremoto', value: '400M', deductible: '5%' }, // new → gained
      ],
    });

    const gaps = computeGapAnalysis(baseline, candidate);
    expect(gaps.coveragesLost).toEqual(['Robo']);
    expect(gaps.coveragesGained).toEqual(['Terremoto']);
  });

  it('treats excluded/empty candidate values as lost coverages', () => {
    const baseline = quote();
    const candidate = quote({
      insurerName: 'CHUBB',
      coverages: [
        { name: 'Incendio', value: '500M', deductible: '10%' },
        { name: 'Responsabilidad Civil', value: 'EXCLUIDO' },
        { name: 'Robo', value: '' },
      ],
    });

    const gaps = computeGapAnalysis(baseline, candidate);
    expect(gaps.coveragesLost).toEqual(['Responsabilidad Civil', 'Robo']);
    expect(gaps.coveragesGained).toEqual([]);
  });

  it('flags deductible worsening when the candidate percentage is higher', () => {
    const baseline = quote();
    const candidate = quote({
      insurerName: 'SBS',
      coverages: [
        { name: 'Incendio', value: '500M', deductible: '15%' }, // worse
        { name: 'Responsabilidad Civil', value: '100M', deductible: '5%' }, // same
        { name: 'Robo', value: '200M', deductible: '5%' }, // better, not flagged
      ],
    });

    const gaps = computeGapAnalysis(baseline, candidate);
    expect(gaps.deductibleWorsening).toEqual(['Incendio']);
  });

  it('lists new exclusions introduced by the candidate', () => {
    const baseline = quote({
      coverages: [
        { name: 'Incendio', value: '500M', deductible: '10%', exclusions: ['Terremoto'] },
      ],
    });
    const candidate = quote({
      insurerName: 'HDI',
      coverages: [
        {
          name: 'Incendio',
          value: '500M',
          deductible: '10%',
          exclusions: ['Terremoto', 'Humo'],
        },
      ],
    });

    const gaps = computeGapAnalysis(baseline, candidate);
    expect(gaps.newExclusions).toEqual(['Humo']);
  });

  it('normalizes names when matching (accents/case do not create phantom gaps)', () => {
    const baseline = quote({ coverages: [{ name: 'Sustracción', value: '100M' }] });
    const candidate = quote({
      insurerName: 'X',
      coverages: [{ name: 'SUSTRACCION', value: '100M' }],
    });

    const gaps = computeGapAnalysis(baseline, candidate);
    expect(gaps.coveragesLost).toEqual([]);
    expect(gaps.coveragesGained).toEqual([]);
  });
});

describe('computePremiumDelta (R2.4)', () => {
  it('computes absolute and percentage delta for an increase', () => {
    const delta = computePremiumDelta(8_500_000, 9_000_000);
    expect(delta.absolute).toBe(500_000);
    expect(delta.percentage).toBeCloseTo(5.88, 2);
    expect(delta.direction).toBe('increase');
  });

  it('computes a decrease', () => {
    const delta = computePremiumDelta(9_000_000, 8_500_000);
    expect(delta.absolute).toBe(-500_000);
    expect(delta.direction).toBe('decrease');
  });

  it('reports equal when premiums match', () => {
    const delta = computePremiumDelta(8_500_000, 8_500_000);
    expect(delta.direction).toBe('equal');
    expect(delta.absolute).toBe(0);
  });

  it('reports unknown when either premium is missing', () => {
    expect(computePremiumDelta(null, 8_500_000).direction).toBe('unknown');
    expect(computePremiumDelta(8_500_000, 0).direction).toBe('unknown');
    expect(computePremiumDelta(null, 8_500_000).absolute).toBeNull();
  });
});

describe('friction registry (R2.5)', () => {
  it('has ramo-specific entries for salud, autos, pyme, vida_grupo and copropiedades', () => {
    expect(FRICTION_REGISTRY.salud.join(' ')).toMatch(/carencias/i);
    expect(FRICTION_REGISTRY.salud.join(' ')).toMatch(/preexistencias/i);
    expect(FRICTION_REGISTRY.autos.join(' ')).toMatch(/siniestralidad/i);
    expect(FRICTION_REGISTRY.pyme.join(' ')).toMatch(/IPC/);
    expect(FRICTION_REGISTRY.vida_grupo.join(' ')).toMatch(/renovaci/i);
    expect(FRICTION_REGISTRY.copropiedades.join(' ')).toMatch(/ndice/i);
  });

  it('returns the ramo-specific notes for a known ramo', () => {
    const notes = getFrictionNotes('salud');
    expect(notes).toEqual(FRICTION_REGISTRY.salud);
  });

  it('returns a generic friction note for other ramos', () => {
    const notes = getFrictionNotes('transporte');
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/fricci/i);
    expect(notes[0]).not.toMatch(/carencias/i);
  });
});

describe('computeRenewalAnalytics', () => {
  it('builds per-candidate analytics combining gaps, premium delta and friction', () => {
    const baseline = quote();
    const candidates = [
      quote({
        insurerName: 'MAPFRE',
        priceAnnual: 9_000_000,
        coverages: [
          { name: 'Incendio', value: '600M', deductible: '15%' },
          { name: 'Responsabilidad Civil', value: '100M', deductible: '5%' },
        ],
      }),
    ];

    const analytics = computeRenewalAnalytics(baseline, candidates, 'pyme');

    expect(analytics).toHaveLength(1);
    const entry = analytics[0]!;
    expect(entry.insurer).toBe('MAPFRE');
    expect(entry.gaps.coveragesLost).toEqual(['Robo']);
    expect(entry.gaps.deductibleWorsening).toEqual(['Incendio']);
    expect(entry.premiumDelta.direction).toBe('increase');
    expect(entry.friction).toEqual(FRICTION_REGISTRY.pyme);
  });
});
