import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  BundleManifestSchema,
  validateTaxonomyBundle,
  validateOntologyBundle,
  validateThesaurusBundle,
  validateBundleManifest,
  assertTaxonomyBundle,
  assertOntologyBundle,
  assertThesaurusBundle,
  assertBundleManifest,
} from '../domainBundleSchema';

describe('domainBundleSchema', () => {
  describe('TaxonomyBundleSchema', () => {
    const validTaxonomy = {
      version: '1.0.0',
      domain: 'pyme',
      metadata: {
        region: 'Colombia',
        currency: 'COP',
        salaryReference: 'SMMLV',
        salaryValue2024: 1423500,
        uvtValue2024: 42412,
      },
      categories: [
        {
          id: 1,
          name: 'Incendio (Edificio y Contenidos)',
          aliases: ['Incendio', 'Edificio'],
        },
        {
          id: 2,
          name: 'Lucro Cesante',
          aliases: ['Pérdida de Beneficios'],
        },
      ],
    };

    it('accepts a valid taxonomy bundle', () => {
      const result = validateTaxonomyBundle(validTaxonomy);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain).toBe('pyme');
        expect(result.data.categories).toHaveLength(2);
      }
    });

    it('rejects missing categories', () => {
      const invalid = { ...validTaxonomy, categories: [] };
      const result = validateTaxonomyBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects negative category id', () => {
      const invalid = {
        ...validTaxonomy,
        categories: [{ id: -1, name: 'Test', aliases: ['T'] }],
      };
      const result = validateTaxonomyBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('works without optional metadata', () => {
      const minimal = {
        version: '1.0.0',
        domain: 'pyme',
        categories: [{ id: 1, name: 'Incendio', aliases: ['Fuego'] }],
      };
      const result = validateTaxonomyBundle(minimal);
      expect(result.success).toBe(true);
    });

    it('assertTaxonomyBundle returns parsed data', () => {
      const data = assertTaxonomyBundle(validTaxonomy);
      expect(data.categories[0].id).toBe(1);
    });

    it('assertTaxonomyBundle throws on invalid data', () => {
      expect(() => assertTaxonomyBundle({})).toThrow();
    });
  });

  describe('OntologyBundleSchema', () => {
    const validOntology = {
      version: '1.0.0',
      domain: 'pyme',
      nodes: [
        {
          id: 'patrimoniales',
          name: 'Patrimoniales',
          level: 1,
          childrenIds: ['incendio'],
          aliases: ['Daño Material'],
          riskType: 'property',
        },
        {
          id: 'incendio',
          name: 'Incendio (Edificio y Contenidos)',
          level: 2,
          parentId: 'patrimoniales',
          childrenIds: [],
          aliases: ['Incendio'],
          riskType: 'property',
          typicalDeductible: '10%',
        },
      ],
      compositePatterns: [
        {
          pattern: 'todo\\s+riesgo',
          components: ['incendio'],
          confidence: 0.85,
        },
      ],
    };

    it('accepts a valid ontology bundle', () => {
      const result = validateOntologyBundle(validOntology);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.nodes).toHaveLength(2);
        expect(result.data.compositePatterns).toHaveLength(1);
      }
    });

    it('rejects invalid node level', () => {
      const invalid = {
        ...validOntology,
        nodes: [
          {
            id: 'test',
            name: 'Test',
            level: 4,
            childrenIds: [],
            aliases: [],
            riskType: 'test',
          },
        ],
      };
      const result = validateOntologyBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects confidence outside 0-1 range', () => {
      const invalid = {
        ...validOntology,
        compositePatterns: [{ pattern: 'test', components: ['a'], confidence: 1.5 }],
      };
      const result = validateOntologyBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('assertOntologyBundle returns parsed data', () => {
      const data = assertOntologyBundle(validOntology);
      expect(data.nodes[1].typicalDeductible).toBe('10%');
    });
  });

  describe('ThesaurusBundleSchema', () => {
    const validThesaurus = {
      version: '1.0.0',
      domain: 'pyme',
      entries: [
        {
          canonicalName: 'Incendio (Edificio y Contenidos)',
          variants: ['Amparo Básico (Incendio)', 'Incendio y Rayo'],
          category: 'Patrimoniales',
        },
        {
          canonicalName: 'Lucro Cesante',
          variants: ['Pérdida de Beneficios'],
          category: 'Patrimoniales',
          type: 'main',
        },
      ],
      extensions: [
        {
          parentCoverage: 'Incendio y Líneas Aliadas (ILA)',
          canonicalName: 'Remoción de Escombros',
          variants: ['Remocion de escombros'],
          category: 'Sub-límites',
          type: 'sub-limit',
        },
      ],
    };

    it('accepts a valid thesaurus bundle', () => {
      const result = validateThesaurusBundle(validThesaurus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.entries).toHaveLength(2);
        expect(result.data.extensions).toHaveLength(1);
      }
    });

    it('accepts thesaurus without optional extensions', () => {
      const minimal = {
        version: '1.0.0',
        domain: 'pyme',
        entries: [
          {
            canonicalName: 'Test',
            variants: ['T'],
            category: 'Test',
          },
        ],
      };
      const result = validateThesaurusBundle(minimal);
      expect(result.success).toBe(true);
    });

    it('rejects invalid entry type', () => {
      const invalid = {
        ...validThesaurus,
        entries: [
          {
            canonicalName: 'Test',
            variants: ['T'],
            category: 'Test',
            type: 'invalid-type',
          },
        ],
      };
      const result = validateThesaurusBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects empty canonicalName', () => {
      const invalid = {
        ...validThesaurus,
        entries: [
          {
            canonicalName: '',
            variants: ['T'],
            category: 'Test',
          },
        ],
      };
      const result = validateThesaurusBundle(invalid);
      expect(result.success).toBe(false);
    });

    it('assertThesaurusBundle returns parsed data', () => {
      const data = assertThesaurusBundle(validThesaurus);
      expect(data.entries[1].type).toBe('main');
      expect(data.extensions![0].parentCoverage).toBe('Incendio y Líneas Aliadas (ILA)');
    });
  });

  describe('BundleManifestSchema', () => {
    const validManifest = {
      version: '1.0.0',
      domain: 'pyme',
      files: ['taxonomy.json', 'ontology.json', 'thesaurus.json'],
    };

    it('accepts a valid bundle manifest via validateBundleManifest', () => {
      const result = validateBundleManifest(validManifest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain).toBe('pyme');
        expect(result.data.files).toHaveLength(3);
      }
    });

    it('rejects invalid manifest data via validateBundleManifest', () => {
      const invalid = { ...validManifest, version: 123 };
      const result = validateBundleManifest(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('rejects missing required fields via validateBundleManifest', () => {
      const missing = { version: '1.0.0' };
      const result = validateBundleManifest(missing);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('returns parsed data via assertBundleManifest', () => {
      const data = assertBundleManifest(validManifest);
      expect(data.version).toBe('1.0.0');
      expect(data.domain).toBe('pyme');
      expect(data.files).toEqual(
        expect.arrayContaining(['taxonomy.json', 'ontology.json', 'thesaurus.json'])
      );
    });

    it('throws on invalid data via assertBundleManifest', () => {
      expect(() => assertBundleManifest({})).toThrow();
    });

    it('throws ZodError with detailed issues on partial invalid data', () => {
      expect(() => assertBundleManifest({ domain: 'test' })).toThrow();
    });

    it('parses valid manifest directly via BundleManifestSchema.parse', () => {
      const data = BundleManifestSchema.parse(validManifest);
      expect(data.version).toBe('1.0.0');
      expect(data.files).toHaveLength(3);
    });

    it('throws ZodError when BundleManifestSchema.parse receives invalid data', () => {
      expect(() => BundleManifestSchema.parse({})).toThrow();
    });

    it('throws ZodError with path info for missing fields', () => {
      try {
        BundleManifestSchema.parse({ version: '1.0.0' });
        expect.fail('Expected parse to throw');
      } catch (error) {
        const zodError = error as ZodError;
        expect(zodError.issues).toBeDefined();
        const paths = zodError.issues.map((i) => i.path);
        expect(paths).toContainEqual(['domain']);
        expect(paths).toContainEqual(['files']);
      }
    });
  });
});
