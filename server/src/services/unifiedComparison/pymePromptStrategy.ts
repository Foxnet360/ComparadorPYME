import { FormatFamily } from '../formatDetector';
import { TemplateRegistryEntry, LayoutTable } from '../../schemas/templateRegistrySchema';
import {
  buildPromptForFamily as buildPymePromptForFamily,
  buildTemplatePrompt as buildPymeTemplatePrompt,
} from '../promptBuilder.base';
import { PromptStrategy, PromptContext } from './promptStrategyFactory';

export const pymePromptStrategy: PromptStrategy = {
  buildPromptForFamily: (family: FormatFamily, context?: PromptContext): string =>
    buildPymePromptForFamily(family, context),

  buildTemplatePrompt: (
    templateId: string,
    template: TemplateRegistryEntry,
    tables: LayoutTable[]
  ): string => buildPymeTemplatePrompt(templateId, template, tables),

  buildCorrectionPrompt: (originalResponse: string, errorMessage: string): string =>
    `Tu respuesta anterior no cumplió el schema de extracción PYME requerido.

ERROR: ${errorMessage}

RESPUESTA ANTERIOR (parcial):
${originalResponse.substring(0, 1000)}

Por favor genera el JSON completo y válido con:
- "insurerName", "policyName", "premium"
- "rawCoverages" con rawName, insuredAmount, deductible, rawTextSnippet y pageNumber
- "subLimits" y "generalDeductibles" si aparecen en el documento

Responde ÚNICAMENTE con el JSON corregido.`,

  getResponseSchema: (): Record<string, unknown> => ({
    type: 'object',
    description: 'PYME quote extraction schema',
    properties: {
      insurerName: { type: 'string' },
      policyName: { type: 'string' },
      validityPeriod: { type: 'string', nullable: true },
      formatFamily: { type: 'string' },
      premium: {
        type: 'object',
        properties: {
          netPremium: { type: 'number' },
          fees: { type: 'number' },
          taxes: { type: 'number' },
          otherCharges: { type: 'number' },
          totalPayable: { type: 'number' },
          currency: { type: 'string' },
          periodicity: { type: 'string', nullable: true },
        },
      },
      insuredAssets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            assetType: { type: 'string' },
            value: { type: 'number' },
            notes: { type: 'string', nullable: true },
          },
        },
        nullable: true,
      },
      rawCoverages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section: { type: 'string', nullable: true },
            rawName: { type: 'string' },
            insuredAmount: { type: 'number', nullable: true },
            deductible: { type: 'string', nullable: true },
            rawTextSnippet: { type: 'string' },
            pageNumber: { type: 'number' },
            premium: { type: 'number', nullable: true },
            notes: { type: 'string', nullable: true },
          },
        },
      },
      subLimits: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            parentCoverage: { type: 'string' },
            name: { type: 'string' },
            limit: { type: 'number' },
            deductible: { type: 'string', nullable: true },
          },
        },
        nullable: true,
      },
      generalDeductibles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            appliesTo: { type: 'string' },
            deductibleText: { type: 'string' },
          },
        },
        nullable: true,
      },
      specialConditions: { type: 'array', items: { type: 'string' }, nullable: true },
      exclusions: { type: 'array', items: { type: 'string' }, nullable: true },
      warranties: { type: 'array', items: { type: 'string' }, nullable: true },
    },
  }),
};
