import { z } from 'zod';
import { env } from '../config/env';

/**
 * Shared Zod schemas for LLM extraction outputs.
 *
 * v1 uses `.passthrough()` to avoid rejecting valid but unusual LLM outputs.
 * Strictness can be increased via `ZOD_SCHEMA_VERSION` when the rollout is stable.
 */

const isStrict = (process.env.ZOD_SCHEMA_VERSION || 'v1') === 'v2';
const passthrough = <T extends z.ZodRawShape>(shape: T) => {
  const base = z.object(shape);
  return isStrict ? base.catchall(z.never()) : base;
};

// -----------------------------------------------------------------------------
// Common / leaf schemas
// -----------------------------------------------------------------------------

export const ExtractedCoverageItemSchema = passthrough({
  name: z.string().min(1),
  value: z.string().nullish(),
  deductible: z.string().nullish(),
});

export const ExpectedCoverageSchema = passthrough({
  name: z.string().min(1),
  status: z.enum(['present', 'missing', 'excluded']),
  value: z.string().nullish(),
  deductible: z.string().nullish(),
});

export const PremiumSchema = passthrough({
  netPremium: z.number().min(0).default(0),
  fees: z.number().min(0).default(0),
  taxes: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  totalPayable: z.number().min(0),
  currency: z.enum(['COP', 'USD']).default('COP'),
  periodicity: z.string().nullish(),
});

export const InsuredAssetSchema = passthrough({
  assetType: z.string().min(1),
  value: z.number().min(0),
  notes: z.string().nullish(),
});

export const RawCoverageSchema = passthrough({
  section: z.string().nullish(),
  rawName: z.string().min(1),
  insuredAmount: z.number().min(0).nullish(),
  deductible: z.string().nullish(),
  rawTextSnippet: z.string().min(10).max(500),
  pageNumber: z.number().int().min(1),
  premium: z.number().min(0).nullish(),
  notes: z.string().nullish(),
});

export const SubLimitSchema = passthrough({
  parentCoverage: z.string().min(1),
  name: z.string().min(1),
  limit: z.number().min(0),
  deductible: z.string().nullish(),
});

export const GeneralDeductibleSchema = passthrough({
  appliesTo: z.string().min(1),
  deductibleText: z.string().min(1),
});

export const CoinsuranceSchema = passthrough({
  percentageSelf: z.number().min(0).max(100),
  percentagePartner: z.number().min(0).max(100).nullish(),
  partnerName: z.string().nullish(),
  notes: z.string().nullish(),
});

export const DemeritClauseSchema = passthrough({
  applies: z.boolean().default(false),
  annualDepreciationRate: z.number().nullish(),
  maxDepreciation: z.number().nullish(),
  ageThresholdYears: z.number().nullish(),
  notes: z.string().nullish(),
});

export const AssistanceItemSchema = passthrough({
  name: z.string().min(1),
  eventCap: z.number().nullish(),
  amountCap: z.string().nullish(),
  details: z.string().nullish(),
});

// -----------------------------------------------------------------------------
// Quote extraction schemas
// -----------------------------------------------------------------------------

export const QuoteExtractionSchemaV2 = passthrough({
  insurerName: z.string().min(1),
  policyName: z.string().min(1),
  validityPeriod: z.string().nullish(),
  formatFamily: z.string().min(1).default('UNKNOWN'),
  premium: PremiumSchema,
  insuredAssets: z.array(InsuredAssetSchema).nullish(),
  rawCoverages: z.array(RawCoverageSchema).min(1),
  subLimits: z.array(SubLimitSchema).nullish(),
  generalDeductibles: z.array(GeneralDeductibleSchema).nullish(),
  coinsurance: CoinsuranceSchema.nullish(),
  demeritClause: DemeritClauseSchema.nullish(),
  assistances: z.array(AssistanceItemSchema).nullish(),
  specialConditions: z.array(z.string()).nullish(),
  exclusions: z.array(z.string()).nullish(),
  warranties: z.array(z.string()).nullish(),
});

export const QuoteExtractionSchema = passthrough({
  insurerName: z.string().min(1),
  policyName: z.string().min(1),
  priceAnnual: z.number().min(0),
  currency: z.enum(['COP', 'USD']).default('COP'),
  validityPeriod: z.string().nullish(),
  coverages: z.array(ExtractedCoverageItemSchema).min(1),
  specialConditions: z.array(z.string()).nullish(),
  expectedCoverages: z.array(ExpectedCoverageSchema).nullish(),
});

// -----------------------------------------------------------------------------
// Deductible schemas
// -----------------------------------------------------------------------------

export const DeductibleComponentSchema = passthrough({
  type: z.enum(['percentage', 'fixed', 'smmlv', 'uvt', 'minimum', 'maximum', 'na', 'unknown']),
  value: z.number(),
  currency: z.string().nullish(),
});

export const DeductibleCompoundOperatorSchema = z.enum([
  'none',
  'greater_of',
  'lesser_of',
  'sum',
  'and',
]);

export const DeductibleStructureSchema = passthrough({
  components: z.array(DeductibleComponentSchema),
  compoundOperator: DeductibleCompoundOperatorSchema.default('none'),
  isZero: z.boolean(),
  hasMinimum: z.boolean(),
  hasMaximum: z.boolean(),
  isComposite: z.boolean(),
  rawText: z.string(),
});

// -----------------------------------------------------------------------------
// Structured clause schemas
// -----------------------------------------------------------------------------

export const ClauseCoverageSchema = passthrough({
  name: z.string().min(1),
  description: z.string().min(1),
  insuredAmount: z.string().nullish(),
  deductible: passthrough({
    components: z.array(DeductibleComponentSchema),
    rawText: z.string(),
  }).nullish(),
  sublimit: z.string().nullish(),
  exclusions: z.array(z.string()).nullish(),
  conditions: z.array(z.string()).nullish(),
  sourcePage: z.number().int().min(1),
});

export const StructuredClauseSchema = passthrough({
  insurer: z.string().min(1),
  product: z.string().min(1),
  documentType: z.enum(['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR']),
  coverages: z.array(ClauseCoverageSchema),
  generalExclusions: z.array(z.string()).nullish(),
  generalConditions: z.array(z.string()).nullish(),
  definitions: z.record(z.string(), z.string()).nullish(),
});

// ---------------------------------------------------------------------------
// Reconciliation schemas
// ---------------------------------------------------------------------------

export const ReconciliationStatusSchema = z.enum([
  'MATCH',
  'MISMATCH',
  'MISSING_CLAUSE',
  'PENDING',
]);

export const ReconciliationThresholdConfigSchema = passthrough({
  default: z.number().min(0).max(1).default(0.05),
  coverageOverrides: z.record(z.string(), z.number().min(0).max(1)).nullish(),
});

export const ReconciliationResultSchema = passthrough({
  coverageName: z.string().min(1),
  quoteDeductible: DeductibleStructureSchema,
  clauseDeductible: DeductibleStructureSchema.nullish(),
  status: ReconciliationStatusSchema,
  confidence: z.number().min(0).max(1),
  discrepancyDetails: z.array(z.string()).nullish(),
});

// -----------------------------------------------------------------------------
// Inferred types
// -----------------------------------------------------------------------------

export type QuoteExtractionV2 = z.infer<typeof QuoteExtractionSchemaV2>;
export type QuoteExtraction = z.infer<typeof QuoteExtractionSchema>;
export type DeductibleStructure = z.infer<typeof DeductibleStructureSchema>;
export type StructuredClauseValidated = z.infer<typeof StructuredClauseSchema>;
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;
export type ReconciliationThresholdConfig = z.infer<typeof ReconciliationThresholdConfigSchema>;
export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;
export type RawCoverage = z.infer<typeof RawCoverageSchema>;
export type SubLimit = z.infer<typeof SubLimitSchema>;
export type GeneralDeductible = z.infer<typeof GeneralDeductibleSchema>;
export type PremiumBreakdown = z.infer<typeof PremiumSchema>;
export type InsuredAsset = z.infer<typeof InsuredAssetSchema>;

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

export function normalizeCurrency(raw: unknown): 'COP' | 'USD' {
  if (typeof raw !== 'string') return 'COP';
  const upper = raw.toUpperCase().trim();
  if (upper === 'USD' || upper === 'US$' || upper === '$USD') return 'USD';
  if (upper === 'COP' || upper === '$' || upper.startsWith('$')) return 'COP';
  return 'COP';
}

export function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  const cleaned = value
    .replace(/[^\d.,-]/g, '')
    .replace(/\./g, '') // thousands separator
    .replace(/,/g, '.');

  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

export interface CurrencyRates {
  smmlv: number;
  uvt: number;
}

const DEFAULT_RATES: CurrencyRates = {
  smmlv: env.SMMLV_VALUE,
  uvt: env.UVT_VALUE,
};

export function normalizeValueToCOP(
  value: number | string,
  unit?: string | null,
  rates: CurrencyRates = DEFAULT_RATES
): number | null {
  const numeric = typeof value === 'number' ? value : parseNumeric(value);
  if (numeric === null) return null;
  if (!unit) return numeric;

  const u = unit.toUpperCase().trim();
  if (u === 'SMMLV') return numeric * rates.smmlv;
  if (u === 'UVT') return numeric * rates.uvt;
  return numeric;
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError };

export function validateWithZod<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export const validateQuoteExtractionV2 = (data: unknown) =>
  validateWithZod(QuoteExtractionSchemaV2, data);

export const validateQuoteExtraction = (data: unknown) =>
  validateWithZod(QuoteExtractionSchema, data);

export const validateDeductibleStructure = (data: unknown) =>
  validateWithZod(DeductibleStructureSchema, data);

export const validateStructuredClause = (data: unknown) =>
  validateWithZod(StructuredClauseSchema, data);

/**
 * Format a Zod error into a short, log-friendly string.
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ');
}
