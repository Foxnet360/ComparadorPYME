import { describe, it, expect } from 'vitest';
import {
  buildPromptForFamily,
  getSupportedFormatFamilies,
  buildTemplatePrompt,
} from '../promptBuilder';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';

const INSURER_NAMES = [
  'hdi',
  'chubb',
  'axa',
  'colpatria',
  'sbs',
  'liberty',
  'bolivar',
  'bolívar',
  'allianz',
  'mapfre',
];

describe('promptBuilder', () => {
  it('returns a prompt for every supported family', () => {
    for (const family of getSupportedFormatFamilies()) {
      const prompt = buildPromptForFamily(family);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(100);
    }
  });

  it('does not include hardcoded insurer names in any prompt', () => {
    for (const family of getSupportedFormatFamilies()) {
      const prompt = buildPromptForFamily(family);
      const lower = prompt.toLowerCase();
      for (const name of INSURER_NAMES) {
        expect(lower).not.toContain(name);
      }
    }
  });

  it('includes complete schema instructions for UNKNOWN family', () => {
    const prompt = buildPromptForFamily('UNKNOWN');
    expect(prompt).toContain('schema flexible estándar');
    expect(prompt).toContain('insurerName');
    expect(prompt).toContain('rawCoverages');
    expect(prompt).toContain('NO inventar');
  });

  it('adds context instructions when provided', () => {
    const prompt = buildPromptForFamily('TABLE-INTEGRATED', {
      pageCount: 3,
      hasTables: true,
      insurerName: 'Genérica',
    });
    expect(prompt).toContain('3 páginas');
    expect(prompt).toContain('contiene tablas');
    expect(prompt).toContain('Genérica');
  });
});

describe('buildTemplatePrompt', () => {
  const template: TemplateRegistryEntry = {
    templateId: 'bbva-pyme-v1',
    insurer: 'BBVA',
    displayName: 'BBVA PYME',
    version: 1,
    fingerprints: {
      textMarkers: ['BBVA SEGUROS'],
      layoutMarkers: [],
      minConfidence: 90,
    },
    schema: {
      type: 'object',
      required: ['coverages'],
      properties: {
        coverages: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
    extractionHints: {
      coverageTablePage: 1,
      deductibleColumnIndex: 2,
    },
    promptAddon: 'Extraer primas de la columna 3.',
  };

  const tables: LayoutTable[] = [
    {
      page: 1,
      bounds: { x: 0, y: 0, width: 500, height: 200 },
      headers: [
        { text: 'Cobertura', x: 0, y: 0, width: 100, height: 12 },
        { text: 'Suma Asegurada', x: 100, y: 0, width: 100, height: 12 },
        { text: 'Deducible', x: 200, y: 0, width: 100, height: 12 },
      ],
      rows: [
        [
          { text: 'Incendio', x: 0, y: 20, width: 100, height: 12 },
          { text: '$500M', x: 100, y: 20, width: 100, height: 12 },
          { text: '10%', x: 200, y: 20, width: 100, height: 12 },
        ],
      ],
    },
  ];

  it('includes template identification and schema', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', template, tables);
    expect(prompt).toContain('bbva-pyme-v1');
    expect(prompt).toContain('BBVA PYME');
    expect(prompt).toContain('Extraer primas de la columna 3');
    expect(prompt).toContain('coverages');
  });

  it('renders reconstructed tables as markdown', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', template, tables);
    expect(prompt).toContain('Cobertura');
    expect(prompt).toContain('Suma Asegurada');
    expect(prompt).toContain('Incendio');
    expect(prompt).toContain('$500M');
  });

  it('includes extraction hints in the prompt', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', template, tables);
    expect(prompt).toContain('deductibleColumnIndex');
    expect(prompt).toContain('coverageTablePage');
  });

  it('falls back gracefully when tables are empty', () => {
    const prompt = buildTemplatePrompt('bbva-pyme-v1', template, []);
    expect(prompt).toContain('No se pudieron reconstruir tablas');
  });
});
