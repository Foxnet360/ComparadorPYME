import { describe, it, expect } from 'vitest';
import { comparisonPromptBuilder, PromptContext } from '../comparisonPromptBuilder';

function buildV2Prompt(context: Partial<PromptContext> = {}, addons?: string[]) {
  return comparisonPromptBuilder.buildV2ComparisonPrompt(
    {
      insurerCount: 2,
      hasClauses: false,
      ...context,
    },
    addons
  );
}

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

describe('comparisonPromptBuilder.buildV2ComparisonPrompt', () => {
  it('suggests granular business-section sub-rows (Bienes, Deducibles, Sustracción, Financiero)', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('BIENES ASEGURADOS');
    expect(prompt).toContain('Mercancías');
    expect(prompt).toContain('DEDUCIBLES');
    expect(prompt).toContain('Todo Riesgo Incendio');
    expect(prompt).toContain('SUSTRACCIÓN');
    expect(prompt).toContain('Sustracción con Violencia');
    expect(prompt).toContain('FINANCIAL');
  });

  it('requests a section-aware comparison table with insurers and rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('insurers');
    expect(prompt).toContain('rows');
    expect(prompt).toContain('section');
    expect(prompt).toContain('cells');
  });

  it('explicitly allows the LLM to omit, add, or rename rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).toContain('omit');
    expect(prompt).toContain('renombrar');
  });

  it('includes deductible sub-rows as a structured example', () => {
    const prompt = buildV2Prompt();

    expect(prompt.toLowerCase()).toContain('deducible');
  });

  it('includes the insurer count in the context', () => {
    const prompt = buildV2Prompt({ insurerCount: 4 });

    expect(prompt).toContain('4 cotizaciones');
  });

  it('does not enforce exactly four rows', () => {
    const prompt = buildV2Prompt();

    expect(prompt).not.toContain('EXACTAMENTE estas filas');
  });

  it('appends insurer-specific template addons when provided', () => {
    const prompt = buildV2Prompt({}, [
      'BBVA: Extrae deducibles de la columna 3 de la tabla.',
      'SBS: Usa los nombres de cobertura exactos del resumen SBS.',
    ]);

    expect(prompt).toContain('BBVA:');
    expect(prompt).toContain('SBS:');
    expect(prompt).toContain('Extrae deducibles de la columna 3');
    expect(prompt.indexOf('BBVA:')).toBeGreaterThan(prompt.indexOf('filas agrupadas por sección'));
  });

  it('keeps the generic prompt when no addons are provided', () => {
    const generic = buildV2Prompt();
    const withEmptyAddons = buildV2Prompt({}, []);

    expect(withEmptyAddons).toBe(generic);
  });

  it('does not inject addons for the flat v1 prompt', () => {
    const prompt = comparisonPromptBuilder.buildComparisonPrompt({ insurerCount: 2 });

    expect(prompt).not.toContain('BBVA:');
    expect(prompt).not.toContain('template');
  });
});
