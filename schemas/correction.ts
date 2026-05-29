import { z } from 'zod';

/**
 * Schema Zod para validación de correcciones
 */
export const CorrectionSchema = z.object({
  rawName: z.string().min(1, 'El nombre raw es requerido'),
  insurerName: z.string().min(1, 'El nombre de la aseguradora es requerido'),
  systemMapping: z.string().min(1, 'El mapeo del sistema es requerido'),
  userCorrection: z.string().min(1, 'La corrección del usuario es requerida'),
  correctionType: z.enum(['coverage_mapping', 'deductible', 'exclusion', 'value']).default('coverage_mapping'),
  quoteId: z.string().optional(),
  rawTextSnippet: z.string().max(2000, 'El snippet no puede exceder 2000 caracteres').optional(),
  aiJustification: z.string().max(2000, 'La justificación no puede exceder 2000 caracteres').optional(),
  pageNumber: z.number().int().positive().optional(),
});

export type CorrectionInput = z.infer<typeof CorrectionSchema>;

/**
 * Schema para respuesta del backend
 */
export const CorrectionResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
});

export type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;
