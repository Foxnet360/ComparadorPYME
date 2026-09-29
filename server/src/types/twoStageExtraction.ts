import { z } from 'zod';
import {
  PremiumSchema,
  InsuredAssetSchema,
  RawCoverageSchema,
  SubLimitSchema,
  GeneralDeductibleSchema,
  QuoteExtractionV2,
  RawCoverage,
  SubLimit,
  GeneralDeductible,
  PremiumBreakdown,
  InsuredAsset,
} from '../schemas/extractionSchemas';

export const CoverageSectionHintSchema = z.object({
  sectionName: z.string().min(1),
  pageNumber: z.number().int().min(1).nullish(),
  description: z.string().nullish(),
});

export type CoverageSectionHint = z.infer<typeof CoverageSectionHintSchema>;

export const GlobalStructureSchema = z.object({
  insurerName: z.string().min(1),
  policyName: z.string().min(1),
  validityPeriod: z.string().nullish(),
  formatFamily: z.string().min(1).default('UNKNOWN'),
  premium: PremiumSchema,
  insuredAssets: z.array(InsuredAssetSchema).nullish(),
  coverageSections: z.array(CoverageSectionHintSchema).nullish(),
  specialConditions: z.array(z.string()).nullish(),
  exclusions: z.array(z.string()).nullish(),
  warranties: z.array(z.string()).nullish(),
});

export type GlobalStructureExtraction = z.infer<typeof GlobalStructureSchema>;

export const FocalizedCoverageSchema = z.object({
  rawCoverages: z.array(RawCoverageSchema).min(1),
  subLimits: z.array(SubLimitSchema).nullish(),
  generalDeductibles: z.array(GeneralDeductibleSchema).nullish(),
});

export type FocalizedCoverageExtraction = z.infer<typeof FocalizedCoverageSchema>;

export interface TwoStageExtractionResult {
  extraction: QuoteExtractionV2;
  stage1Success: boolean;
  stage2Success: boolean;
  fallbackToSingleStage: boolean;
  reason?: string;
}
