import { describe, it, expect } from 'vitest';
import { loadDomainBundleManifest } from '../domainBundleLoader';

describe('domainBundleLoader', () => {
  describe('loadDomainBundleManifest', () => {
    it('returns a valid manifest for the pyme domain', () => {
      const manifest = loadDomainBundleManifest('pyme');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.domain).toBe('pyme');
      expect(manifest.files).toContain('taxonomy.json');
      expect(manifest.files).toContain('ontology.json');
      expect(manifest.files).toContain('thesaurus.json');
      expect(manifest.files).toHaveLength(3);
    });

    it('falls back to pyme manifest for a nonexistent domain', () => {
      const manifest = loadDomainBundleManifest('nonexistent-domain-test');
      expect(manifest.domain).toBe('pyme');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.files).toHaveLength(3);
    });
  });
});
