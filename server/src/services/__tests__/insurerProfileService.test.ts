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

describe('insurerProfileService.getCanonicalMapping', () => {
  it('returns Incendio for SBS AMPARO BASICO variant', () => {
    const canonical = insurerProfileService.getCanonicalMapping(
      'SBS',
      'AMPARO BASICO - TODO RIESGO DANO MATERIAL'
    );
    expect(canonical).toBe('Incendio (Edificio y Contenidos)');
  });

  it('returns Incendio for SBS "Todo riesgo daños materiales" variation', () => {
    const canonical = insurerProfileService.getCanonicalMapping(
      'SBS',
      'Todo riesgo daños materiales'
    );
    expect(canonical).toBe('Incendio (Edificio y Contenidos)');
  });

  it('returns null for a generic insurer', () => {
    const canonical = insurerProfileService.getCanonicalMapping(
      'DESCONOCIDA',
      'AMPARO BASICO - TODO RIESGO DANO MATERIAL'
    );
    expect(canonical).toBeNull();
  });

  it('returns null when insurer has no deterministic override for the raw name', () => {
    const canonical = insurerProfileService.getCanonicalMapping(
      'SBS',
      'Cobertura Exótica Desconocida'
    );
    expect(canonical).toBeNull();
  });

  it('returns null when raw name is empty', () => {
    expect(insurerProfileService.getCanonicalMapping('SBS', '')).toBeNull();
    expect(insurerProfileService.getCanonicalMapping('', 'AMPARO BASICO')).toBeNull();
  });
});
