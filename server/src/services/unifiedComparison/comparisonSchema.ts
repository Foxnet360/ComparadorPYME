/**
 * JSON Schema for UnifiedComparisonResult validation
 * Used with Gemini 3.5 Flash structured output
 */

import { z } from 'zod';
import { Type } from '@google/genai';
const SchemaType = Type;

export enum SchemaSection {
  INFORMACION_GENERAL = 'INFORMACIÓN GENERAL',
  BIENES_ASEGURADOS = 'BIENES ASEGURADOS',
  COBERTURAS = 'COBERTURAS',
  DEDUCIBLES = 'DEDUCIBLES',
  CONDICIONES = 'CONDICIONES',
}

// -----------------------------------------------------------------------------
// Flat comparison schema (direct-LLM table output)
// -----------------------------------------------------------------------------

export const FlatComparisonMetadataSchema = z.object({
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  pdfCount: z.number().int().min(1),
  processingTimeMs: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  fromCache: z.boolean().optional(),
});

export const FlatComparisonCellSchemaV1 = z.object({
  insurer: z.string().min(1),
  value: z.string().nullable(),
  rawText: z.string().optional(),
  notFound: z.boolean().optional(),
});

export const FlatComparisonCellSchemaV2 = z.object({
  insurer: z.string().min(1),
  value: z.string().nullable(),
  rawText: z.string().optional(),
  notFound: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isAmbiguous: z.boolean().optional(),
});

export const FlatComparisonRowSchemaV1 = z.object({
  label: z.string().min(1),
  cells: z.array(FlatComparisonCellSchemaV1),
});

export const FlatComparisonRowSchemaV2 = z.object({
  label: z.string().min(1),
  section: z.string().optional(),
  cells: z.array(FlatComparisonCellSchemaV2),
});

export const FlatComparisonSchemaV1 = z
  .object({
    metadata: FlatComparisonMetadataSchema,
    insurers: z.array(z.string().min(1)).min(1),
    schemaVersion: z.number().default(1).optional(),
    rows: z.array(FlatComparisonRowSchemaV1).length(4),
    extraRows: z.array(FlatComparisonRowSchemaV1).default([]),
    warnings: z.array(z.string()).default([]),
  })
  .refine(
    (data) =>
      data.rows.every(
        (row) =>
          row.cells.length === data.insurers.length &&
          row.cells.every((cell) => data.insurers.includes(cell.insurer))
      ),
    { message: 'Each row must contain one cell per insurer' }
  );

export const FlatComparisonSchemaV2 = z
  .object({
    metadata: FlatComparisonMetadataSchema,
    insurers: z.array(z.string().min(1)).min(1),
    schemaVersion: z.number().default(2),
    rows: z.array(FlatComparisonRowSchemaV2),
    extraRows: z.array(FlatComparisonRowSchemaV2).default([]),
    warnings: z.array(z.string()).default([]),
  })
  .refine(
    (data) =>
      data.rows.every(
        (row) =>
          row.cells.length === data.insurers.length &&
          row.cells.every((cell) => data.insurers.includes(cell.insurer))
      ),
    { message: 'Each row must contain one cell per insurer' }
  );

export const FlatComparisonSchema = FlatComparisonSchemaV2;
export const FlatComparisonCellSchema = FlatComparisonCellSchemaV2;
export const FlatComparisonRowSchema = FlatComparisonRowSchemaV2;

export type FlatComparisonResultV1 = z.infer<typeof FlatComparisonSchemaV1>;
export type FlatComparisonRowV1 = z.infer<typeof FlatComparisonRowSchemaV1>;
export type FlatComparisonCellV1 = z.infer<typeof FlatComparisonCellSchemaV1>;
export type FlatComparisonResultV2 = z.infer<typeof FlatComparisonSchemaV2>;
export type FlatComparisonRowV2 = z.infer<typeof FlatComparisonRowSchemaV2>;
export type FlatComparisonCellV2 = z.infer<typeof FlatComparisonCellSchemaV2>;
export type FlatComparisonResult = z.infer<typeof FlatComparisonSchema>;
export type FlatComparisonRow = z.infer<typeof FlatComparisonRowSchema>;
export type FlatComparisonCell = z.infer<typeof FlatComparisonCellSchema>;

export function resolveComparisonSchemaVersion(result: unknown, flagEnabled: boolean): 1 | 2 {
  if (!flagEnabled) return 1;
  const resultVersion =
    typeof result === 'object' && result !== null && 'schemaVersion' in result
      ? (result as { schemaVersion: unknown }).schemaVersion
      : undefined;
  return resultVersion === 2 ? 2 : 1;
}

// -----------------------------------------------------------------------------
// Legacy Gemini structured-output schema (kept for rollback)
// -----------------------------------------------------------------------------

export const UnifiedComparisonSchema = {
  description: 'Structured comparison result for insurance quotes',
  type: SchemaType.OBJECT,
  properties: {
    metadata: {
      type: SchemaType.OBJECT,
      properties: {
        generatedAt: { type: SchemaType.STRING },
        model: { type: SchemaType.STRING },
        thinkingLevel: { type: SchemaType.STRING },
        pdfCount: { type: SchemaType.NUMBER },
        totalPages: { type: SchemaType.NUMBER },
        confidence: { type: SchemaType.NUMBER },
        needsHumanReview: { type: SchemaType.BOOLEAN },
        processingTimeMs: { type: SchemaType.NUMBER },
      },
      required: [
        'generatedAt',
        'model',
        'thinkingLevel',
        'pdfCount',
        'confidence',
        'needsHumanReview',
      ],
    },
    client: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        activity: { type: SchemaType.STRING },
        ciiu: { type: SchemaType.STRING, nullable: true },
        address: { type: SchemaType.STRING },
        city: { type: SchemaType.STRING },
        totalInsuredValue: { type: SchemaType.NUMBER },
      },
      required: ['name', 'activity', 'address', 'city', 'totalInsuredValue'],
    },
    insurers: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quoteDate: { type: SchemaType.STRING },
          validity: { type: SchemaType.STRING },
          product: { type: SchemaType.STRING },
          logo: { type: SchemaType.STRING, nullable: true },
        },
        required: ['name', 'quoteDate', 'validity', 'product'],
      },
    },
    coverageMatrix: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          category: { type: SchemaType.STRING },
          isExclusive: { type: SchemaType.BOOLEAN, nullable: true },
          rows: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                type: {
                  type: SchemaType.STRING,
                  enum: ['value', 'deductible', 'includes', 'exclusions', 'notes'],
                },
                label: { type: SchemaType.STRING },
                cells: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      value: { type: SchemaType.STRING, nullable: true },
                      rawText: { type: SchemaType.STRING, nullable: true },
                      confidence: { type: SchemaType.NUMBER, nullable: true },
                      pageNumber: { type: SchemaType.NUMBER, nullable: true },
                      isAmbiguous: { type: SchemaType.BOOLEAN, nullable: true },
                      notes: { type: SchemaType.STRING, nullable: true },
                    },
                    required: ['value'],
                  },
                },
              },
              required: ['type', 'label', 'cells'],
            },
          },
        },
        required: ['category', 'rows'],
      },
    },
    financials: {
      type: SchemaType.OBJECT,
      properties: {
        premiums: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              netPremium: { type: SchemaType.NUMBER, nullable: true },
              fees: { type: SchemaType.NUMBER, nullable: true },
              taxes: { type: SchemaType.NUMBER, nullable: true },
              total: { type: SchemaType.NUMBER, nullable: true },
              percentageOfValue: { type: SchemaType.NUMBER, nullable: true },
            },
            required: ['insurer'],
          },
        },
        metadata: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              commission: { type: SchemaType.STRING, nullable: true },
              backing: { type: SchemaType.STRING, nullable: true },
              modality: { type: SchemaType.STRING, nullable: true },
              asistencia: { type: SchemaType.STRING, nullable: true },
            },
            required: ['insurer'],
          },
        },
      },
      required: ['premiums', 'metadata'],
    },
    analysis: {
      type: SchemaType.OBJECT,
      properties: {
        bestValue: { type: SchemaType.STRING, nullable: true },
        warnings: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
        missingCoverages: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              insurer: { type: SchemaType.STRING },
              coverage: { type: SchemaType.STRING },
            },
            required: ['insurer', 'coverage'],
          },
        },
        significantDifferences: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              coverage: { type: SchemaType.STRING },
              difference: { type: SchemaType.STRING },
              severity: {
                type: SchemaType.STRING,
                enum: ['high', 'medium', 'low'],
              },
            },
            required: ['coverage', 'difference', 'severity'],
          },
        },
      },
      required: ['warnings', 'missingCoverages', 'significantDifferences'],
    },
  },
  required: ['metadata', 'client', 'insurers', 'coverageMatrix', 'financials', 'analysis'],
};
