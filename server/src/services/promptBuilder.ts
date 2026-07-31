/**
 * Prompt Builder Service
 * Public entry point for extraction prompts.
 *
 * Backward-compatible wrapper that routes through the domain-aware prompt
 * strategy factory. Existing callers that do not pass a `domain` continue to
 * receive the original PYME prompt unchanged.
 */

import { FormatFamily } from './formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../schemas/templateRegistrySchema';
import {
  buildPromptForFamily as buildPymePromptForFamily,
  buildTemplatePrompt as buildPymeTemplatePrompt,
  getSupportedFormatFamilies as getSupportedFormatFamiliesBase,
  isFormatFamilySupported as isFormatFamilySupportedBase,
  PromptContext as BasePromptContext,
} from './promptBuilder.base';
import { promptStrategyFactory } from './unifiedComparison/promptStrategyFactory';

export type PromptContext = BasePromptContext;

/**
 * Build a domain-aware extraction prompt for a format family.
 * When `context.domain` is omitted, defaults to `pyme` for 100% backward
 * compatibility.
 */
export function buildPromptForFamily(family: FormatFamily, context?: PromptContext): string {
  const domain = context?.domain ?? 'pyme';
  return promptStrategyFactory
    .getStrategy(domain as 'pyme' | 'autos')
    .buildPromptForFamily(family, context);
}

/**
 * Build a domain-aware layout-aware template prompt.
 * The optional `domain` parameter defaults to `pyme`.
 */
export function buildTemplatePrompt(
  templateId: string,
  template: TemplateRegistryEntry,
  tables: LayoutTable[],
  domain?: string
): string {
  const d = domain ?? 'pyme';
  return promptStrategyFactory
    .getStrategy(d as 'pyme' | 'autos')
    .buildTemplatePrompt(templateId, template, tables);
}

/**
 * Re-export base helpers unchanged.
 */
export function getSupportedFormatFamilies(): FormatFamily[] {
  return getSupportedFormatFamiliesBase();
}

export function isFormatFamilySupported(family: FormatFamily): boolean {
  return isFormatFamilySupportedBase(family);
}

/**
 * Re-export the PYME implementations so callers that need the raw PYME logic
 * (e.g. golden snapshots) can import them directly without going through the
 * factory.
 */
export { buildPymePromptForFamily, buildPymeTemplatePrompt };
