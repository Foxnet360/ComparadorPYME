import { z } from 'zod';

// ---------------------------------------------------------------------------
// Template registry schemas
// ---------------------------------------------------------------------------

export const TemplateFingerprintsSchema = z.object({
  textMarkers: z.array(z.string()),
  layoutMarkers: z.array(
    z.object({
      page: z.number().int().positive().optional(),
      region: z.string().min(1),
      textRegex: z.string().min(1),
    })
  ),
  minConfidence: z.number().min(0).max(100).default(90),
});

export const TemplateExtractionHintsSchema = z.object({
  coverageTablePage: z.number().int().positive().optional(),
  deductibleColumnIndex: z.number().int().nonnegative().optional(),
  premiumColumnIndex: z.number().int().nonnegative().optional(),
});

export const TemplateRegistryEntrySchema = z.object({
  templateId: z.string().min(1),
  insurer: z.string().min(1),
  displayName: z.string().min(1),
  version: z.number().int().positive().default(1),
  fingerprints: TemplateFingerprintsSchema,
  schema: z.record(z.string(), z.unknown()),
  extractionHints: TemplateExtractionHintsSchema,
  promptAddon: z.string().default(''),
});

// ---------------------------------------------------------------------------
// Layout parser schemas
// ---------------------------------------------------------------------------

export const LayoutCellSchema = z.object({
  text: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  colSpan: z.number().int().positive().optional(),
});

export const LayoutTableSchema = z.object({
  page: z.number().int().positive(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  headers: z.array(LayoutCellSchema),
  rows: z.array(z.array(LayoutCellSchema)),
  mergedCells: z.array(LayoutCellSchema).optional(),
});

// ---------------------------------------------------------------------------
// Coverage semantic graph schemas
// ---------------------------------------------------------------------------

export const GraphNodeTypeSchema = z.enum([
  'raw_term',
  'insurer_alias',
  'canonical_category',
  'deductible_rule',
  'composite_rule',
]);

export const GraphEdgeTypeSchema = z.enum([
  'alias',
  'alias_of',
  'maps_to',
  'decomposes_to',
  'applies_to',
  'deductible_for',
  'excludes',
  'learned',
]);

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  type: GraphNodeTypeSchema,
  insurer: z.string().optional(),
});

export const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: GraphEdgeTypeSchema,
  weight: z.number().min(0).max(1),
  correctionCount: z.number().int().nonnegative().optional(),
  insurer: z.string().optional(),
  domain: z.string().optional(),
});

export const GraphMappingSchema = z.object({
  canonicalId: z.string().min(1),
  confidence: z.number().min(0).max(1),
  provenance: z.string().min(1),
});

export const GraphDeductibleLinkSchema = z.object({
  deductibleText: z.string().min(1),
  appliesTo: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const GraphQueryResultSchema = z.object({
  mappings: z.array(GraphMappingSchema),
  composite: z.boolean(),
  components: z.array(z.string()).optional(),
  deductibleLinks: z.array(GraphDeductibleLinkSchema).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TemplateFingerprints = z.infer<typeof TemplateFingerprintsSchema>;
export type TemplateExtractionHints = z.infer<typeof TemplateExtractionHintsSchema>;
export type TemplateRegistryEntry = z.infer<typeof TemplateRegistryEntrySchema>;
export type LayoutCell = z.infer<typeof LayoutCellSchema>;
export type LayoutTable = z.infer<typeof LayoutTableSchema>;
export type GraphNodeType = z.infer<typeof GraphNodeTypeSchema>;
export type GraphEdgeType = z.infer<typeof GraphEdgeTypeSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphMapping = z.infer<typeof GraphMappingSchema>;
export type GraphDeductibleLink = z.infer<typeof GraphDeductibleLinkSchema>;
export type GraphQueryResult = z.infer<typeof GraphQueryResultSchema>;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateTemplateRegistryEntry(data: unknown) {
  return TemplateRegistryEntrySchema.safeParse(data);
}

export function assertTemplateRegistryEntry(data: unknown): TemplateRegistryEntry {
  return TemplateRegistryEntrySchema.parse(data);
}

export function validateLayoutTable(data: unknown) {
  return LayoutTableSchema.safeParse(data);
}

export function validateGraphEdge(data: unknown) {
  return GraphEdgeSchema.safeParse(data);
}

export function validateGraphQueryResult(data: unknown) {
  return GraphQueryResultSchema.safeParse(data);
}
