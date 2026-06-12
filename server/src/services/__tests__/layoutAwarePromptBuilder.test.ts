import { describe, it, expect } from 'vitest';
import { buildTemplatePrompt } from '../layoutAwarePromptBuilder';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';

function makeTemplate(): TemplateRegistryEntry {
  return {
    templateId: 'bbva-pyme-v1',
    insurer: 'BBVA',
    displayName: 'BBVA PYME',
    version: 1,
    fingerprints: {
      textMarkers: ['BBVA'],
      layoutMarkers: [],
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
    promptAddon: 'Extrae los valores exactos de la tabla.',
  };
}

function makeTable(): LayoutTable {
  return {
    page: 1,
    bounds: { x: 100, y: 600, width: 400, height: 120 },
    headers: [
      { text: 'Cobertura', x: 100, y: 700, width: 80, height: 12 },
      { text: 'Suma Asegurada', x: 260, y: 700, width: 100, height: 12 },
      { text: 'Deducible', x: 420, y: 700, width: 80, height: 12 },
    ],
    rows: [
      [
        { text: 'Incendio', x: 100, y: 680, width: 60, height: 12 },
        { text: '$ 100.000.000', x: 260, y: 680, width: 100, height: 12 },
        { text: '5% min 1 SMMLV', x: 420, y: 680, width: 100, height: 12 },
      ],
    ],
  };
}

describe('layoutAwarePromptBuilder', () => {
  it('includes the template schema in the prompt', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', makeTemplate(), [makeTable()]);

    expect(prompt).toContain('bbva-pyme-v1');
    expect(prompt).toContain('"type": "object"');
    expect(prompt).toContain('coverages');
  });

  it('renders reconstructed tables as markdown', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', makeTemplate(), [makeTable()]);

    expect(prompt).toContain('| Cobertura | Suma Asegurada | Deducible |');
    expect(prompt).toContain('| Incendio | $ 100.000.000 | 5% min 1 SMMLV |');
  });

  it('includes the template prompt addon and extraction hints', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', makeTemplate(), [makeTable()]);

    expect(prompt).toContain('Extrae los valores exactos de la tabla.');
    expect(prompt).toContain('"deductibleColumnIndex": 2');
  });

  it('gracefully handles an empty table list', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', makeTemplate(), []);

    expect(prompt).toContain('No se pudieron reconstruir tablas');
    expect(prompt).toContain('bbva-pyme-v1');
  });

  it('highlights merged cells when present', () => {
    const table = makeTable();
    table.mergedCells = [{ text: 'DAÑOS MATERIALES', x: 100, y: 680, width: 80, height: 12 }];

    const prompt = buildTemplatePrompt('bbva-pyme-v1', makeTemplate(), [table]);

    expect(prompt).toContain('DAÑOS MATERIALES');
  });
});
