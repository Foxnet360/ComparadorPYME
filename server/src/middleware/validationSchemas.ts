import { z } from 'zod';
import { RENEWAL_OUTCOMES, RENEWAL_STATES } from '../services/renewalStateMachine';

// Common schemas
export const uuidSchema = z.string().uuid();
export const limitOffsetSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
});

// API Request Schemas

export const analyzeRequestSchema = z.object({
  clientName: z.string().min(1).max(200).optional(),
  clauseIds: z.string().optional(), // JSON string array
  clientProfile: z
    .object({
      industry: z.string().optional(),
      location: z.string().optional(),
      size: z.string().optional(),
    })
    .optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  reportContext: z.any().optional(),
  useRAG: z.boolean().optional(),
  threadId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string(),
      })
    )
    .optional(),
});

export const chatSuggestionsSchema = z.object({
  reportContext: z.any().optional(),
  threadId: z.string().optional(),
});

export const createDocumentSchema = z.object({
  insurerName: z.string().min(1).max(200),
  documentName: z.string().min(1).max(300),
  documentType: z.enum(['CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR', 'MANUAL', 'OTRO']),
  productName: z.string().max(200).optional(),
  version: z.string().max(50).optional(),
});

export const listDocumentsSchema = z.object({
  insurerId: z.string().optional(),
  documentType: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  latest: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  insurerId: z.string().optional(),
  coverageTag: z.string().optional(),
  sectionType: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5)),
});

export const analysisValidationSchema = z.object({
  quote: z.object({
    insurerName: z.string(),
    coverages: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
        deductible: z.string().optional(),
      })
    ),
  }),
  insurerName: z.string(),
});

export const deductibleRiskSchema = z.object({
  coverageName: z.string(),
  quoteDeductible: z.string(),
  insuredAmount: z.number().optional(),
});

export const inverseCheckSchema = z.object({
  quote: z.object({
    insurerName: z.string(),
    coverages: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
      })
    ),
  }),
  insurerName: z.string(),
});

export const auditEnrichSchema = z.object({
  quoteId: z.string().optional(),
  coverageName: z.string(),
  insurerName: z.string(),
  deductible: z.string().optional(),
  exclusions: z.array(z.string()).optional(),
});

// Portfolio schemas (renovacion-polizas PR-2). R1.4: zod's default object
// behavior strips unknown keys, so only the whitelisted fields below ever
// reach the repositories.
export const createClientSchema = z.object({
  name: z.string().min(1).max(300),
  tax_id: z.string().max(50).nullish(),
  contact: z.record(z.string(), z.unknown()).optional(),
});

export const updateClientSchema = z
  .object({
    name: z.string().min(1).max(300).optional(),
    tax_id: z.string().max(50).nullish(),
    contact: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const createPolicySchema = z.object({
  client_id: z.string().uuid(),
  ramo: z.string().min(1),
  insurer: z.string().min(1).max(300),
  policy_number: z.string().max(120).nullish(),
  premium: z.number().nonnegative().nullish(),
  start_date: z.string().min(1).nullish(),
  end_date: z.string().min(1).nullish(),
  coverages: z.array(z.unknown()).optional(),
  deductibles: z.array(z.unknown()).optional(),
  provenance: z.enum(['analysis', 'incumbent_pdf', 'manual']).optional(),
  source_analysis_id: z.string().uuid().nullish(),
  ramo_details: z.record(z.string(), z.unknown()).optional(),
});

export const updatePolicySchema = z
  .object({
    ramo: z.string().min(1).optional(),
    insurer: z.string().min(1).max(300).optional(),
    policy_number: z.string().max(120).nullish(),
    premium: z.number().nonnegative().nullish(),
    start_date: z.string().min(1).nullish(),
    end_date: z.string().min(1).nullish(),
    coverages: z.array(z.unknown()).optional(),
    deductibles: z.array(z.unknown()).optional(),
    provenance: z.enum(['analysis', 'incumbent_pdf', 'manual']).optional(),
    source_analysis_id: z.string().uuid().nullish(),
    ramo_details: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

// Q4: the broker confirms what extraction cannot know (policy number, dates,
// client link, per-ramo insured object); the mapper auto-carries the rest.
export const promotePolicySchema = z.object({
  analysis_id: z.string().uuid(),
  quote_index: z.number().int().nonnegative(),
  confirmations: z.object({
    client_id: z.string().uuid(),
    policy_number: z.string().min(1).max(120),
    start_date: z.string().min(1),
    end_date: z.string().min(1),
    insured: z.record(z.string(), z.unknown()),
  }),
});

// Renewal lifecycle schemas (renovacion-polizas PR-4). The state machine
// (renewalStateMachine.ts) owns the transition/outcome RULES; these schemas
// only gate shape and known values at the HTTP boundary (R3.1/R3.2).
export const listRenewalsQuerySchema = z.object({
  state: z.enum(RENEWAL_STATES).optional(),
});

export const transitionRenewalSchema = z.object({
  to: z.enum(RENEWAL_STATES),
  outcome: z.enum(RENEWAL_OUTCOMES).nullish(),
  final_premium: z.number().nonnegative().nullish(),
  loss_reason: z.string().min(1).max(500).nullish(),
});

// Campaign config schema (renovacion-polizas PR-4, R4.1): windows are whole
// days before policy end_date, at least one, at most a year out.
export const updateCampaignConfigSchema = z.object({
  windows: z.array(z.number().int().min(1).max(365)).min(1).max(10),
  enabled: z.boolean(),
});
