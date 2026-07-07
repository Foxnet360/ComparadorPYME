import { z } from 'zod';

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
