import { describe, it, expect } from 'vitest';
import { QuoteExtractionSchemaV2, extractHighSignalReferenceText } from '../gemini';
import { ComparisonPromptBuilder } from '../unifiedComparison/comparisonPromptBuilder';

describe('Phase 1: Snippet Window Expansion', () => {
  it('should specify 50-300 characters in QuoteExtractionSchemaV2 description', () => {
    const rawTextSnippetProp =
      QuoteExtractionSchemaV2.properties.rawCoverages.items.properties.rawTextSnippet;
    expect(rawTextSnippetProp.description).toContain('50-300');
  });

  it('should include critical extraction completeness rule in ComparisonPromptBuilder', () => {
    const builder = new ComparisonPromptBuilder();
    const prompt = builder.buildV2ComparisonPrompt({ insurerCount: 2 });
    expect(prompt).toContain('REGLA CRÍTICA DE COMPLETITUD');
  });
});

describe('extractHighSignalReferenceText', () => {
  it('returns rawText unchanged when length is within maxChars', () => {
    const shortText = 'Carátula de póliza PYME: Incendio $500.000.000 COP, Deducible 10%';
    expect(extractHighSignalReferenceText(shortText, 45000)).toBe(shortText);
  });

  it('bounds output to maxChars while preserving header and high-signal numeric/deductible lines', () => {
    const headerSection = 'ENCABEZADO DE CARÁTULA Y PRIMA TOTAL '.repeat(40); // ~1480 chars
    const fillerProse = Array.from(
      { length: 200 },
      () => 'Cláusula descriptiva general sin valores ni montos específicos en este párrafo.'
    ).join('\n');
    const highSignalSection = [
      'Sección de Amparos Adicionales',
      'Terremoto, Temblor o Erupción Volcánica: $1.200.000.000 COP - Deducible: 2% mínimo 5 SMMLV',
      'Nota aclaratoria del amparo catastrófico.',
      'Responsabilidad Civil Extracontractual: $800.000.000 COP - Deducible: 10% mínimo 3 SMMLV',
    ].join('\n');

    const rawText = `${headerSection}\n${fillerProse}\n${highSignalSection}\n${fillerProse}`;
    const maxChars = 2500;
    const result = extractHighSignalReferenceText(rawText, maxChars);

    expect(result.length).toBeLessThanOrEqual(maxChars);
    expect(result).toContain('ENCABEZADO DE CARÁTULA');
    expect(result).toContain('Terremoto, Temblor o Erupción Volcánica: $1.200.000.000 COP');
    expect(result).toContain('Deducible: 2% mínimo 5 SMMLV');
    expect(result).toContain('Responsabilidad Civil Extracontractual: $800.000.000 COP');
  });
});
