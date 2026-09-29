import { describe, it, expect } from 'vitest';
import { resolveCertaintyBand } from '../coverageOntology';

describe('coverageOntology - resolveCertaintyBand (Tri-Banda de Certeza)', () => {
  it('resolves trusted for high certainty (>= 85%)', () => {
    expect(resolveCertaintyBand(0.95)).toBe('trusted');
    expect(resolveCertaintyBand(0.85)).toBe('trusted');
    expect(resolveCertaintyBand(1.0)).toBe('trusted');
  });

  it('resolves ambiguous for intermediate certainty (50% to 84%) requiring validation', () => {
    expect(resolveCertaintyBand(0.84)).toBe('ambiguous');
    expect(resolveCertaintyBand(0.65)).toBe('ambiguous');
    expect(resolveCertaintyBand(0.50)).toBe('ambiguous');
  });

  it('resolves autonomous for low certainty (< 50%) to avoid forced categorization', () => {
    expect(resolveCertaintyBand(0.49)).toBe('autonomous');
    expect(resolveCertaintyBand(0.20)).toBe('autonomous');
    expect(resolveCertaintyBand(0)).toBe('autonomous');
  });

  it('resolves autonomous when marked as exclusive regardless of raw score', () => {
    expect(resolveCertaintyBand(0.90, true)).toBe('autonomous');
    expect(resolveCertaintyBand(0.60, true)).toBe('autonomous');
  });
});
