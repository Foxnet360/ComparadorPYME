/**
 * Quote Validation Schema
 * Zod schemas for validating extracted quote data
 */

import { z } from 'zod';

export const CoverageItemSchema = z.object({
  name: z.string().min(1, 'Coverage name is required'),
  value: z.string().min(1, 'Coverage value is required'),
  deductible: z.string().default('No aplica'),
});

export const ExpectedCoverageSchema = z.object({
  name: z.string().min(1, 'Coverage name is required'),
  status: z.enum(['present', 'missing', 'excluded']),
  value: z.string().nullable().optional(),
  deductible: z.string().nullable().optional(),
});

export const QuoteExtractionSchema = z.object({
  insurerName: z.string().min(1, 'Insurer name is required'),
  policyName: z.string().min(1, 'Policy name is required'),
  priceAnnual: z.number().min(0, 'Price must be positive'),
  currency: z.enum(['COP', 'USD']).default('COP'),
  validityPeriod: z.string().optional(),
  coverages: z.array(CoverageItemSchema).min(1, 'At least one coverage is required'),
  specialConditions: z.array(z.string()).default([]),
  expectedCoverages: z.array(ExpectedCoverageSchema).optional(),
});

export type ValidatedQuote = z.infer<typeof QuoteExtractionSchema>;

/**
 * Validate extracted quote data
 * Returns { success: true, data } or { success: false, errors }
 */
export function validateQuoteExtraction(data: any): { 
  success: true; 
  data: ValidatedQuote;
} | { 
  success: false; 
  errors: string[];
} {
  try {
    const validated = QuoteExtractionSchema.parse(data);
    return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
            return { success: false, errors };
        }
        return { success: false, errors: ['Unknown validation error'] };
    }
}

/**
 * Validate with loose schema (allows extra fields)
 * Used for backward compatibility
 */
export function validateQuoteExtractionLoose(data: any): {
    success: true;
    data: ValidatedQuote;
} | {
    success: false;
    errors: string[];
} {
    try {
        const validated = QuoteExtractionSchema.passthrough().parse(data);
        return { success: true, data: validated as ValidatedQuote };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
            return { success: false, errors };
        }
        return { success: false, errors: ['Unknown validation error'] };
    }
}
