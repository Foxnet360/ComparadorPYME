import { z } from 'zod';

// ---------------------------------------------------------------------------
// Taxonomy bundle schemas
// ---------------------------------------------------------------------------

export const TaxonomyCategorySchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional().default([]),
});

export const TaxonomyBundleSchema = z.object({
  version: z.string(),
  domain: z.string(),
  metadata: z
    .object({
      region: z.string().optional(),
      currency: z.string().optional(),
      salaryReference: z.string().optional(),
      salaryValue2024: z.number().positive().optional(),
      uvtValue2024: z.number().positive().optional(),
    })
    .passthrough()
    .optional(),
  categories: z.array(TaxonomyCategorySchema).min(1),
});

// ---------------------------------------------------------------------------
// Ontology bundle schemas
// ---------------------------------------------------------------------------

export const OntologyNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(3),
  parentId: z.string().optional(),
  childrenIds: z.array(z.string()),
  aliases: z.array(z.string()),
  riskType: z.string(),
  typicalDeductible: z.string().optional(),
});

export const CompositePatternSchema = z.object({
  pattern: z.string(),
  components: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const OntologyBundleSchema = z.object({
  version: z.string(),
  domain: z.string(),
  nodes: z.array(OntologyNodeSchema),
  compositePatterns: z.array(CompositePatternSchema),
});

// ---------------------------------------------------------------------------
// Thesaurus bundle schemas
// ---------------------------------------------------------------------------

export const ThesaurusEntrySchema = z.object({
  canonicalName: z.string().min(1),
  variants: z.array(z.string().min(1)),
  category: z.string().optional(),
  type: z.enum(['main', 'sub-limit', 'rider', 'gastos', 'extension']).optional(),
  parentCoverage: z.string().optional(),
});

export const ThesaurusBundleSchema = z.object({
  version: z.string(),
  domain: z.string(),
  entries: z.array(ThesaurusEntrySchema),
  extensions: z.array(ThesaurusEntrySchema).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TaxonomyBundle = z.infer<typeof TaxonomyBundleSchema>;
export type OntologyBundle = z.infer<typeof OntologyBundleSchema>;
export type ThesaurusBundle = z.infer<typeof ThesaurusBundleSchema>;

export type TaxonomyCategory = z.infer<typeof TaxonomyCategorySchema>;
export type OntologyNode = z.infer<typeof OntologyNodeSchema>;
export type ThesaurusEntry = z.infer<typeof ThesaurusEntrySchema>;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateTaxonomyBundle(data: unknown) {
  return TaxonomyBundleSchema.safeParse(data);
}

export function validateOntologyBundle(data: unknown) {
  return OntologyBundleSchema.safeParse(data);
}

export function validateThesaurusBundle(data: unknown) {
  return ThesaurusBundleSchema.safeParse(data);
}

export function assertTaxonomyBundle(data: unknown): TaxonomyBundle {
  return TaxonomyBundleSchema.parse(data);
}

export function assertOntologyBundle(data: unknown): OntologyBundle {
  return OntologyBundleSchema.parse(data);
}

export function assertThesaurusBundle(data: unknown): ThesaurusBundle {
  return ThesaurusBundleSchema.parse(data);
}

// ---------------------------------------------------------------------------
// Bundle manifest schema
// ---------------------------------------------------------------------------

export const BundleManifestSchema = z.object({
  version: z.string(),
  domain: z.string(),
  files: z.array(z.string().min(1)),
});

export type BundleManifest = z.infer<typeof BundleManifestSchema>;

export function validateBundleManifest(data: unknown) {
  return BundleManifestSchema.safeParse(data);
}

export function assertBundleManifest(data: unknown): BundleManifest {
  return BundleManifestSchema.parse(data);
}
