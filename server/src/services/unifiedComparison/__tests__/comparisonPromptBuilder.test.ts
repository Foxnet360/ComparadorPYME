import { describe, it, expect } from 'vitest';
import { comparisonPromptBuilder } from '../comparisonPromptBuilder';

describe('comparisonPromptBuilder', () => {
  it('includes the four flat row labels in the comparison prompt', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 3 });

    expect(prompt).toContain('Bienes Asegurados');
    expect(prompt).toContain('Deducibles');
    expect(prompt).toContain('Prima con IVA');
    expect(prompt).toContain('Forma de Pago');
  });

  it('requests JSON output with insurers and rows schema', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });

    expect(prompt).toContain('"insurers"');
    expect(prompt).toContain('"rows"');
    expect(prompt).toContain('"label"');
    expect(prompt).toContain('"cells"');
    expect(prompt).toContain('No informado');
  });

  it('does not include legacy canonical coverage categories', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });

    expect(prompt).not.toContain('Amparo Básico');
    expect(prompt).not.toContain('Terremoto');
    expect(prompt).not.toContain('Responsabilidad Civil Extracontractual');
  });

  it('includes the insurer count in the context', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 4 });

    expect(prompt).toContain('4 cotizaciones');
  });

  it('builds a correction prompt referencing the original response and error', () => {
    const correction = comparisonPromptBuilder.buildCorrectionPrompt('bad json', 'missing rows');

    expect(correction).toContain('bad json');
    expect(correction).toContain('missing rows');
    expect(correction).toContain('JSON');
  });
});
