import { describe, it, expect } from 'vitest';
import {
  extractTables,
  detectRotatedPages,
  LayoutPage,
  LayoutTextItem,
  LayoutParserOptions,
} from '../layoutParser';

function item(text: string, x: number, y: number, width = 60, height = 12, rotation = 0): LayoutTextItem {
  return { text, x, y, width, height, rotation };
}

function page(pageNumber: number, items: LayoutTextItem[]): LayoutPage {
  return { page: pageNumber, items };
}

const HEADER_TOKENS = ['cobertura', 'suma asegurada', 'deducible', 'prima'];

function makeSimpleTable(): LayoutTextItem[] {
  return [
    // header row (y = 700)
    item('Cobertura', 100, 700),
    item('Suma Asegurada', 260, 700),
    item('Deducible', 420, 700),
    // row 1
    item('Incendio', 100, 680),
    item('$ 100.000.000', 260, 680),
    item('5% min 1 SMMLV', 420, 680),
    // row 2
    item('Terremoto', 100, 660),
    item('$ 50.000.000', 260, 660),
    item('10% min 5 SMMLV', 420, 660),
  ];
}

function makeSingleColumnItems(): LayoutTextItem[] {
  return [
    item('SECCION PRIMERA', 100, 700),
    item('Amparo básico todo riesgo', 100, 680),
    item('Valor asegurado', 100, 660),
    item('$ 200.000.000', 100, 640),
  ];
}

describe('layoutParser', () => {
  describe('extractTables', () => {
    it('clusters a simple three-column table with header detection', () => {
      const result = extractTables([page(1, makeSimpleTable())], {
        headerTokens: HEADER_TOKENS,
      } as LayoutParserOptions);

      expect(result.failed).toBe(false);
      expect(result.tables).toHaveLength(1);

      const table = result.tables[0];
      expect(table.page).toBe(1);
      expect(table.headers).toHaveLength(3);
      expect(table.headers.map((h) => h.text)).toEqual(['Cobertura', 'Suma Asegurada', 'Deducible']);
      expect(table.rows).toHaveLength(2);
      expect(table.rows[0].map((c) => c.text)).toEqual(['Incendio', '$ 100.000.000', '5% min 1 SMMLV']);
      expect(table.rows[1].map((c) => c.text)).toEqual(['Terremoto', '$ 50.000.000', '10% min 5 SMMLV']);
    });

    it('detects two tables separated by a vertical gap', () => {
      const items: LayoutTextItem[] = [
        // first table
        item('Cobertura', 100, 700),
        item('Suma', 260, 700),
        item('Incendio', 100, 680),
        item('$ 100', 260, 680),
        // gap
        item('Detalle de primas', 100, 620),
        // second table
        item('Concepto', 100, 580),
        item('Valor', 260, 580),
        item('Prima neta', 100, 560),
        item('$ 1.200.000', 260, 560),
      ];

      const result = extractTables([page(1, items)], {
        headerTokens: HEADER_TOKENS,
      } as LayoutParserOptions);

      expect(result.tables).toHaveLength(2);
      // First table has a recognized header row, second does not.
      expect(result.tables[0].headers).toHaveLength(2);
      expect(result.tables[0].rows).toHaveLength(1);
      expect(result.tables[1].rows).toHaveLength(2);
    });

    it('marks the result as failed when fewer than two columns are found', () => {
      const result = extractTables([page(1, makeSingleColumnItems())]);

      expect(result.failed).toBe(true);
      expect(result.tables).toHaveLength(0);
      expect(result.failureReason).toContain('columns');
    });

    it('returns an empty result for a page with no text items', () => {
      const result = extractTables([page(1, [])]);

      expect(result.failed).toBe(true);
      expect(result.tables).toHaveLength(0);
      expect(result.failureReason).toContain('No text items');
    });

    it('classifies header, body and footer regions around detected tables', () => {
      const items: LayoutTextItem[] = [
        item('BBVA SEGUROS', 100, 780),
        item('Cotización PYME', 100, 760),
        item('Cobertura', 100, 700),
        item('Suma Asegurada', 260, 700),
        item('Incendio', 100, 680),
        item('$ 100.000.000', 260, 680),
        item('Página 1 de 2', 100, 60),
      ];

      const result = extractTables([page(1, items)], {
        headerTokens: HEADER_TOKENS,
      } as LayoutParserOptions);

      expect(result.tables).toHaveLength(1);
      const regionTypes = result.regions.map((r) => r.type).sort();
      expect(regionTypes).toContain('table');
      expect(regionTypes).toContain('header');
      expect(regionTypes).toContain('footer');
    });

    it('detects merged cells when adjacent rows repeat the same text in the same column', () => {
      const items: LayoutTextItem[] = [
        item('Sección', 100, 700),
        item('Cobertura', 240, 700),
        item('DAÑOS MATERIALES', 100, 680),
        item('Incendio', 240, 680),
        item('DAÑOS MATERIALES', 100, 660),
        item('Terremoto', 240, 660),
      ];

      const result = extractTables([page(1, items)]);

      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].mergedCells?.length).toBeGreaterThan(0);
      const mergedTexts = result.tables[0].mergedCells?.map((c) => c.text);
      expect(mergedTexts).toContain('DAÑOS MATERIALES');
    });
  });

  describe('detectRotatedPages', () => {
    it('flags a page where most items are rotated', () => {
      const items: LayoutTextItem[] = [
        item('Rotado A', 100, 700, 60, 12, 90),
        item('Rotado B', 100, 680, 60, 12, 90),
        item('Rotado C', 100, 660, 60, 12, 90),
      ];

      const result = extractTables([page(1, items)]);

      expect(result.rotatedPages).toContain(1);
      expect(result.failed).toBe(true);
      expect(result.failureReason).toContain('rotated');
    });

    it('does not flag a page with normal horizontal text', () => {
      const result = extractTables([page(1, makeSimpleTable())]);

      expect(result.rotatedPages).toHaveLength(0);
    });
  });

  describe('detectRotatedPages helper', () => {
    it('returns the rotated page numbers', () => {
      const pages = [
        page(1, [item('A', 0, 0, 10, 10, 0), item('B', 20, 0, 10, 10, 0)]),
        page(2, [item('A', 0, 0, 10, 10, 90), item('B', 20, 0, 10, 10, 90)]),
      ];

      expect(detectRotatedPages(pages)).toEqual([2]);
    });
  });
});
