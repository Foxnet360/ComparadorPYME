import { describe, it, expect } from 'vitest';
import { loadDomainJson } from '../domainBundleLoader';
import { assertTemplateRegistryEntry } from '../../schemas/templateRegistrySchema';
import { TemplateRegistryEntry } from '../../types/templateGraph';

describe('template seeds', () => {
  it('loads three insurer templates from the pyme bundle', () => {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');

    expect(seeds).toHaveLength(3);
    const ids = seeds.map((s) => s.templateId);
    expect(ids).toContain('bbva-pyme-v1');
    expect(ids).toContain('sbs-pyme-v1');
    expect(ids).toContain('mapfre-pyme-v1');
  });

  it('validates the BBVA template entry', () => {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');
    const bbva = seeds.find((s) => s.templateId === 'bbva-pyme-v1');
    expect(bbva).toBeDefined();

    const validated = assertTemplateRegistryEntry(bbva);
    expect(validated.insurer).toBe('BBVA');
    expect(validated.displayName).toBe('BBVA PYME');
    expect(validated.fingerprints.textMarkers).toContain('BBVA SEGUROS');
    expect(validated.fingerprints.textMarkers).toContain('COBERTURAS / DEDUCIBLE');
    expect(validated.extractionHints.deductibleColumnIndex).toBeGreaterThanOrEqual(0);
  });

  it('validates the SBS template entry', () => {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');
    const sbs = seeds.find((s) => s.templateId === 'sbs-pyme-v1');
    expect(sbs).toBeDefined();

    const validated = assertTemplateRegistryEntry(sbs);
    expect(validated.insurer).toBe('SBS');
    expect(validated.fingerprints.textMarkers).toContain('SEGUROS SBS');
    expect(validated.fingerprints.textMarkers).toContain('Resumen de coberturas y primas');
  });

  it('validates the MAPFRE template entry', () => {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');
    const mapfre = seeds.find((s) => s.templateId === 'mapfre-pyme-v1');
    expect(mapfre).toBeDefined();

    const validated = assertTemplateRegistryEntry(mapfre);
    expect(validated.insurer).toBe('MAPFRE');
    expect(validated.fingerprints.textMarkers).toContain('MAPFRE');
    expect(validated.fingerprints.textMarkers).toEqual(
      expect.arrayContaining([expect.stringMatching(/SECCION\s+PRIMERA/i)])
    );
  });

  it('requires coverages in every template schema', () => {
    const seeds = loadDomainJson<TemplateRegistryEntry[]>('pyme', 'template-seeds.json');

    for (const seed of seeds) {
      const validated = assertTemplateRegistryEntry(seed);
      const schema = validated.schema as { required?: string[] };
      expect(schema.required).toContain('coverages');
    }
  });
});
