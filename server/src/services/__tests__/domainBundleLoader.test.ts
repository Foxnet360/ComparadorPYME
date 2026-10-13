import { describe, it, expect } from 'vitest';
import { loadDomainBundleManifest, loadDomainJson } from '../domainBundleLoader';
import { INSURANCE_DOMAINS } from '../../types/domain';
import { assertOntologyBundle, assertTaxonomyBundle } from '../../schemas/domainBundleSchema';

describe('domainBundleLoader', () => {
  describe('loadDomainBundleManifest', () => {
    it('returns a valid manifest for the pyme domain', () => {
      const manifest = loadDomainBundleManifest('pyme');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.domain).toBe('pyme');
      expect(manifest.files).toContain('taxonomy.json');
      expect(manifest.files).toContain('ontology.json');
      expect(manifest.files).toContain('thesaurus.json');
      expect(manifest.files).toContain('template-seeds.json');
      expect(manifest.files).toHaveLength(4);
    });

    it('falls back to pyme manifest for a nonexistent domain', () => {
      const manifest = loadDomainBundleManifest('nonexistent-domain-test');
      expect(manifest.domain).toBe('pyme');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.files).toContain('template-seeds.json');
      expect(manifest.files).toHaveLength(4);
    });
  });

  describe('Multi-domain coverage and ontology parity', () => {
    it.each(INSURANCE_DOMAINS)('loads a valid ontology bundle for domain "%s"', (domain) => {
      const rawOntology = loadDomainJson(domain, 'ontology.json');
      const ontology = assertOntologyBundle(rawOntology);

      expect(ontology.domain).toBe(domain);
      expect(ontology.nodes.length).toBeGreaterThan(0);

      // Verify node hierarchy: L1 roots and L2 coverages exist
      const l1Nodes = ontology.nodes.filter((n) => n.level === 1);
      const l2Nodes = ontology.nodes.filter((n) => n.level === 2);

      expect(l1Nodes.length).toBeGreaterThan(0);
      expect(l2Nodes.length).toBeGreaterThan(0);

      // Every L2 node must have a parentId pointing to an existing L1 node
      for (const l2 of l2Nodes) {
        expect(l2.parentId).toBeDefined();
        const parent = l1Nodes.find((l1) => l1.id === l2.parentId);
        expect(parent).toBeDefined();
        expect(parent!.childrenIds).toContain(l2.id);
      }
    });

    it.each(INSURANCE_DOMAINS)('loads a valid taxonomy bundle for domain "%s"', (domain) => {
      const rawTaxonomy = loadDomainJson(domain, 'taxonomy.json');
      const taxonomy = assertTaxonomyBundle(rawTaxonomy);

      expect(taxonomy.domain).toBe(domain);
      expect(taxonomy.categories.length).toBeGreaterThan(0);
    });

    it('does NOT silently fall back to pyme when ontology.json is requested for nonexistent domain', () => {
      expect(() => {
        loadDomainJson('invalid_unknown_domain', 'ontology.json');
      }).toThrow(/Domain bundle file not found: ontology\.json/);
    });

    it('respects allowFallback: false for any file', () => {
      expect(() => {
        loadDomainJson('invalid_unknown_domain', 'taxonomy.json', { allowFallback: false });
      }).toThrow(/Domain bundle file not found: taxonomy\.json/);
    });
  });
});
