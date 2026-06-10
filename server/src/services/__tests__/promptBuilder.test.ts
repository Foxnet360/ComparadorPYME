import { describe, it, expect } from 'vitest';
import { buildPromptForFamily, getSupportedFormatFamilies } from '../promptBuilder';

const INSURER_NAMES = [
  'hdi', 'chubb', 'axa', 'colpatria', 'sbs', 'liberty',
  'bolivar', 'bolívar', 'allianz', 'mapfre',
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
