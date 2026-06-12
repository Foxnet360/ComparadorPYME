import { describe, it, expect } from 'vitest';
import { insurerProfileService } from '../insurerProfileService';

describe('insurerProfileService registry integration', () => {
  it('returns a registry seed for a known insurer', () => {
    const seed = insurerProfileService.getRegistrySeed('BBVA');

    expect(seed).toBeDefined();
    expect(seed?.templateId).toBe('bbva-pyme-v1');
    expect(seed?.insurer).toBe('BBVA');
    expect(seed?.fingerprints.textMarkers).toContain('BBVA SEGUROS');
  });

  it('returns undefined for an unsupported insurer', () => {
    const seed = insurerProfileService.getRegistrySeed('NOBODY');
    expect(seed).toBeUndefined();
  });

  it('returns seeds for all supported insurers', () => {
    const seeds = insurerProfileService.getAllRegistrySeeds();

    expect(seeds).toHaveLength(3);
    const ids = seeds.map((s) => s.templateId);
    expect(ids).toContain('bbva-pyme-v1');
    expect(ids).toContain('sbs-pyme-v1');
    expect(ids).toContain('mapfre-pyme-v1');
  });

  it('maps insurer display names to registry display names', () => {
    const seeds = insurerProfileService.getAllRegistrySeeds();

    const sbs = seeds.find((s) => s.insurer === 'SBS');
    expect(sbs?.displayName).toBe('SBS PYME');
  });
});
