import { describe, it, expect } from 'vitest';
import { QuoteExtractionSchemaV2 } from '../gemini';
import { ComparisonPromptBuilder } from '../unifiedComparison/comparisonPromptBuilder';

describe('Phase 1: Snippet Window Expansion', () => {
  it('should specify 50-300 characters in QuoteExtractionSchemaV2 description', () => {
    const rawTextSnippetProp =
      QuoteExtractionSchemaV2.properties.rawCoverages.items.properties.rawTextSnippet;
    expect(rawTextSnippetProp.description).toContain('50-300');
  });

  it('should include 50-300 character snippet rule in ComparisonPromptBuilder', () => {
    const builder = new ComparisonPromptBuilder();
    const prompt = builder.buildV2ComparisonPrompt({ insurerCount: 2 });
    expect(prompt).toContain('50 y 300 caracteres');
  });
});
