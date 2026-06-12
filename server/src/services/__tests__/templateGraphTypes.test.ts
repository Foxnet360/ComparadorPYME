import { describe, it, expect } from 'vitest';
import {
  TemplateRegistryEntry,
  LayoutTable,
  LayoutCell,
  GraphEdge,
  GraphQueryResult,
  GraphNode,
} from '../../types/templateGraph';
import {
  validateTemplateRegistryEntry,
  validateGraphEdge,
} from '../../schemas/templateRegistrySchema';

describe('template graph domain types', () => {
  describe('TemplateRegistryEntry', () => {
    it('accepts a valid BBVA-style template entry', () => {
      const entry: TemplateRegistryEntry = {
        templateId: 'bbva-pyme-v1',
        insurer: 'BBVA',
        displayName: 'BBVA PYME',
        version: 1,
        fingerprints: {
          textMarkers: ['BBVA SEGUROS', 'COBERTURAS / DEDUCIBLE'],
          layoutMarkers: [{ page: 1, region: 'top-right', textRegex: 'BBVA' }],
          minConfidence: 90,
        },
        schema: {
          type: 'object',
          required: ['coverages'],
          properties: {
            coverages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['rawName', 'insuredAmount', 'deductible'],
                properties: {
                  rawName: { type: 'string' },
                  insuredAmount: { type: 'string' },
                  deductible: { type: 'string' },
                  premium: { type: 'string' },
                  subLimits: { type: 'array' },
                },
              },
            },
          },
        },
        extractionHints: {
          coverageTablePage: 1,
          deductibleColumnIndex: 2,
          premiumColumnIndex: 3,
        },
        promptAddon: 'Extrae las coberturas en español.',
      };

      const result = validateTemplateRegistryEntry(entry);
      expect(result.success).toBe(true);
    });

    it('rejects an entry without a templateId', () => {
      const invalid = {
        insurer: 'BBVA',
        displayName: 'BBVA PYME',
        version: 1,
        fingerprints: { textMarkers: [], layoutMarkers: [], minConfidence: 90 },
        schema: {},
        extractionHints: {},
        promptAddon: '',
      };

      const result = validateTemplateRegistryEntry(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('LayoutTable / LayoutCell', () => {
    it('supports row/column reconstruction output', () => {
      const cell: LayoutCell = {
        text: 'Incendio',
        x: 120,
        y: 300,
        width: 80,
        height: 12,
      };

      const table: LayoutTable = {
        page: 1,
        bounds: { x: 100, y: 280, width: 400, height: 200 },
        headers: [cell],
        rows: [[cell]],
        mergedCells: [cell],
      };

      expect(table.page).toBe(1);
      expect(table.rows[0][0].text).toBe('Incendio');
    });
  });

  describe('GraphNode / GraphEdge / GraphQueryResult', () => {
    it('supports canonical category nodes and learned edges', () => {
      const node: GraphNode = {
        id: 'cat:incendio-edificio-contenidos',
        type: 'canonical_category',
      };

      const edge: GraphEdge = {
        from: 'raw:daño-material-global',
        to: node.id,
        type: 'learned',
        weight: 0.85,
        correctionCount: 12,
      };

      expect(validateGraphEdge(edge).success).toBe(true);
      expect(edge.to).toBe('cat:incendio-edificio-contenidos');
    });

    it('supports graph query results with mappings and deductible links', () => {
      const result: GraphQueryResult = {
        mappings: [
          { canonicalId: 'incendio-edificio-contenidos', confidence: 0.92, provenance: 'alias' },
        ],
        composite: true,
        components: ['incendio', 'terremoto', 'hmacc'],
        deductibleLinks: [
          { deductibleText: '10% min 5 SMMLV', appliesTo: 'terremoto', confidence: 0.9 },
        ],
      };

      expect(result.composite).toBe(true);
      expect(result.mappings).toHaveLength(1);
      expect(result.deductibleLinks).toHaveLength(1);
    });

    it('rejects a graph edge with an invalid type', () => {
      const edge = {
        from: 'raw:foo',
        to: 'cat:bar',
        type: 'invalid_type',
        weight: 0.5,
      };

      const result = validateGraphEdge(edge);
      expect(result.success).toBe(false);
    });
  });
});
