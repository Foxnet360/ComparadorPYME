import { describe, it, expect } from 'vitest';
import { buildPromptForFamily } from '../../server/src/services/promptBuilder';
import { buildTemplatePrompt } from '../../server/src/services/promptBuilder';
import type { TemplateRegistryEntry } from '../../server/src/schemas/templateRegistrySchema';

describe('promptBuilder grounding clauses', () => {
  it('includes grounding rules for every format family', () => {
    const families = [
      'TABLE-DOUBLE',
      'TABLE-INTEGRATED',
      'SECTIONS',
      'DESCRIPTIVE',
      'PRICE-TABLE',
      'CONDITIONS',
      'TEXT',
      'UNKNOWN',
    ] as const;

    for (const family of families) {
      const prompt = buildPromptForFamily(family);
      expect(prompt).toContain('GROUNDING RULES');
      expect(prompt).toContain('rawTextSnippet');
      expect(prompt).toContain('pageNumber');
      expect(prompt).toContain('ANTI-HALLUCINATION RULES');
      expect(prompt).toContain('NO ESPECIFICADO');
    }
  });

  it('includes grounding rules in template prompts', () => {
    const template: TemplateRegistryEntry = {
      id: 'test-template',
      insurer: 'TEST',
      displayName: 'Test Template',
      domain: 'pyme',
      schema: { type: 'object', properties: {} },
      extractionHints: {},
      promptAddon: '',
      version: '1.0.0',
    };

    const prompt = buildTemplatePrompt('test-template', template, []);
    expect(prompt).toContain('GROUNDING RULES');
    expect(prompt).toContain('rawTextSnippet');
    expect(prompt).toContain('pageNumber');
    expect(prompt).toContain('ANTI-HALLUCINATION RULES');
  });
});
