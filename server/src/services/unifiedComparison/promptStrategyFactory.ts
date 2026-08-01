import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import { InsuranceDomain } from '../../types/domain';
import { pymePromptStrategy } from './pymePromptStrategy';
import { autosPromptStrategy } from './autosPromptStrategy';
import { copropiedadesPromptStrategy } from './copropiedadesPromptStrategy';

export interface PromptContext {
  pageCount?: number;
  hasTables?: boolean;
  insurerName?: string;
  formatFamily?: string;
}

export interface PromptStrategy {
  buildPromptForFamily(family: FormatFamily, context?: PromptContext): string;
  buildTemplatePrompt(
    templateId: string,
    template: TemplateRegistryEntry,
    tables: LayoutTable[]
  ): string;
  buildCorrectionPrompt(originalResponse: string, errorMessage: string): string;
  getResponseSchema(): Record<string, unknown>;
}

const PROMPT_STRATEGIES: Record<InsuranceDomain, PromptStrategy> = {
  pyme: pymePromptStrategy,
  autos: autosPromptStrategy,
  copropiedades: copropiedadesPromptStrategy,
};

/**
 * Select the extraction prompt strategy for an insurance domain.
 * Unknown domains fall back to the PYME strategy to preserve backward
 * compatibility.
 */
export function getStrategy(domain: InsuranceDomain): PromptStrategy {
  return PROMPT_STRATEGIES[domain] ?? pymePromptStrategy;
}

/**
 * Factory object for callers that prefer an object-style API.
 */
export const promptStrategyFactory = {
  getStrategy,
};
