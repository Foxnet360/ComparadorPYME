# Design: Granular Comparison Schema

## Technical Approach

Replace the rigid four-row `FlatComparisonResult` with a versioned, section-aware schema v2. The LLM receives a templated granular prompt with suggested sub-rows (Edificio, Contenidos, Mercancías, per-coverage deductibles, Prima, Forma de Pago) but is explicitly allowed to omit, add, or rename rows. After parsing, the system normalizes discovered labels to canonical labels via an alias dictionary, assigns each canonical row to a section, computes per-cell confidence from extraction signals, and transforms the result into `MatrixRow[]` with section headers for the UI. Schema v1 remains available behind a feature flag for backward compatibility and cached results.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Schema versioning | Add `schemaVersion` to `FlatComparisonResult`; v2 is default when flag is on | In-band shape detection only | Allows cached v1 objects and rollback without reprocessing every record |
| Row model | Open row count with optional `section` and per-cell `confidence` | Keep fixed 4 rows | Matches LLM chat-style tables and lets the parser preserve unmatched rows as `extraRows` |
| Alias matching | Canonical dictionary + specificity scoring; ambiguous labels → `extraRows` | Strict ontology mapping | Preserves insurer wording while grouping equivalent concepts; avoids forcing rows into the 14-category ontology |
| Section assignment | Dictionary maps canonical labels to fixed sections | Infer sections from LLM output | Deterministic, testable, and resilient to LLM section inconsistencies |
| Confidence | Derived per-cell from signals | Hardcoded `0.85` | Satisfies spec requirement and surfaces low-quality extractions in the UI |
| Feature flag | Add `granularComparisonSchema` to `FeatureFlags` and `UnifiedComparisonFeatureFlag` | Reuse `useUnifiedComparisonEngine` | Independent toggle lets ops disable only the new schema without killing the unified engine |
| Backward compat | v1 cached objects routed through legacy matrix path or regenerated | Auto-migrate cache | Avoids destructive cache migration; legacy path is kept for one release cycle |

## Data Flow

```
PDFs ──→ UnifiedComparisonEngine ──→ ComparisonPromptBuilder (v2 prompt)
                │
                ↓
         Gemini single-call
                │
                ↓
         flatTableParser (alias normalize + section assign + confidence)
                │
                ↓
         FlatComparisonResult { schemaVersion: 2, rows[], extraRows[] }
                │
                ↓
         matrixTransformer ──→ MatrixRow[] (header + section rows + data rows)
                │
                ↓
         UnifiedCoverageMatrix / VirtualizedCoverageMatrix
```

## Data Model Changes

### `FlatComparisonResult` (v2)

```typescript
export const FlatComparisonCellSchema = z.object({
  insurer: z.string().min(1),
  value: z.string().nullable(),
  rawText: z.string().optional(),
  notFound: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(), // NEW
  isAmbiguous: z.boolean().optional(),               // NEW
});

export const FlatComparisonRowSchema = z.object({
  label: z.string().min(1),
  section: z.string().optional(),                    // NEW
  cells: z.array(FlatComparisonCellSchema),
});

export const FlatComparisonSchema = z.object({
  metadata: FlatComparisonMetadataSchema,
  insurers: z.array(z.string().min(1)).min(1),
  schemaVersion: z.number().default(2),              // NEW
  rows: z.array(FlatComparisonRowSchema),              // open count
  extraRows: z.array(FlatComparisonRowSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
```

### `MatrixRow` / `MatrixCell`

`MatrixRow` and `MatrixCell` already carry `sectionId` and `confidence`; no breaking type change is needed. The transformer will emit `type: 'header'` rows for each section and `type: 'data'` rows for canonical sub-rows.

## Alias Normalization & Section Assignment

```typescript
const ALIAS_MAP: Array<{ aliases: string[]; canonical: string; section: string }> = [
  { aliases: ['bienes asegurados'], canonical: 'Bienes Asegurados', section: 'INFORMACIÓN GENERAL' },
  { aliases: ['edificio', 'valor edificio'], canonical: 'Edificio', section: 'BIENES ASEGURADOS' },
  { aliases: ['contenidos', 'contenido'], canonical: 'Contenidos', section: 'BIENES ASEGURADOS' },
  { aliases: ['mercancías', 'mercaderías'], canonical: 'Mercancías', section: 'BIENES ASEGURADOS' },
  { aliases: ['equipo eléctrico', 'eq. eléctrico', 'eee'], canonical: 'Equipo Eléctrico', section: 'COBERTURAS' },
  { aliases: ['deducible', 'deducibles'], canonical: 'Deducibles', section: 'DEDUCIBLES' },
  { aliases: ['prima con iva', 'prima total con iva'], canonical: 'Prima con IVA', section: 'INFORMACIÓN GENERAL' },
  { aliases: ['forma de pago'], canonical: 'Forma de Pago', section: 'INFORMACIÓN GENERAL' },
];

function normalizeAlias(input: string): string | undefined {
  const normalized = normalizeLabel(input);
  const matches = ALIAS_MAP.filter((entry) =>
    entry.aliases.some((a) => normalized.includes(a))
  );
  if (matches.length === 0) return undefined;
  // Prefer most specific alias (longest match)
  matches.sort((a, b) => b.aliases[0].length - a.aliases[0].length);
  return matches[0].canonical;
}
```

Ambiguous labels (e.g., "Equipo" matching both EEE and Maquinaria) are kept under the original label in `extraRows` and flagged with `isAmbiguous: true`.

## Confidence Calculation

```typescript
function computeCellConfidence(cell: FlatComparisonCell, aliasQuality: number): number {
  let score = 1.0;
  if (cell.notFound) score -= 0.5;
  if (!cell.rawText || cell.rawText.trim().length === 0) score -= 0.15;
  score *= aliasQuality; // 0.5–1.0 based on alias specificity
  if (!isValidValuePattern(cell.value)) score -= 0.15;
  if (cell.isAmbiguous) score -= 0.2;
  return Math.max(0.0, Math.min(1.0, score));
}
```

| Signal | Impact |
|--------|--------|
| `notFound === true` | −0.5 |
| Missing `rawText` | −0.15 |
| Alias match quality | ×0.5–1.0 (exact = 1.0, partial = 0.7, fallback = 0.5) |
| Value pattern invalid | −0.15 |
| `isAmbiguous` | −0.2 |

## UI/UX Changes

- `UnifiedCoverageMatrix` renders `type: 'header'` rows with full `colSpan` and existing blue style (`#E6F0FA`, `#0066CC`).
- Data rows under a section keep the soft gray label column (`#F8FAFC`) and alternate backgrounds.
- Confidence badges use `cell.confidence` (green ≥ 0.9, yellow ≥ 0.7, red < 0.7); tooltips show raw text, canonical name, and source.
- `VirtualizedCoverageMatrix` recognizes the same `type: 'header'` rows and renders them spanning all columns.
- Export preserves section headers as labeled rows before their data rows.

## Backward Compatibility & Feature Flag

- Add `granularComparisonSchema: boolean` to `FeatureFlags` and `UnifiedComparisonFeatureFlag`.
- Default to `false` in production until verification passes; set via `GRANULAR_COMPARISON_SCHEMA=true`.
- When disabled, `ComparisonEngineAdapter` uses the legacy `ComparisonPromptBuilder.buildV1ComparisonPrompt()` and `FlatComparisonSchemaV1`.
- Cached results without `schemaVersion` or with `schemaVersion === 1` are routed through the legacy matrix path (`flatResultToMatrixRowsV1`) or regenerated with v2 when the flag is enabled.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modify | Add `schemaVersion`, `section`, `confidence`, `isAmbiguous`; keep v1 schema as `FlatComparisonSchemaV1` |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modify | Add `buildV2ComparisonPrompt()` with granular template; keep `buildV1ComparisonPrompt()` |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modify | Expand alias map, open row count, section assignment, per-cell confidence |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modify | Group rows by `section`, emit header rows, preserve `confidence` |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modify | Route by `granularComparisonSchema` flag; handle v1 cache fallback |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modify | Pass flag to prompt builder; pass flag context to parser |
| `server/src/config/featureFlags.ts` | Modify | Add `granularComparisonSchema` and env mapping |
| `server/src/services/unifiedComparison/featureFlagService.ts` | Modify | Add `granularComparisonFlag` rollout helpers |
| `server/src/controllers/analysisController.ts` | Modify | Preserve `section` and `confidence` in report conversion |
| `server/src/evaluation/extractionQualityEval.ts` | Modify | Variable row count, label-based matching, regenerate baseline |
| `components/UnifiedCoverageMatrix.tsx` | Modify | Render section headers and use `cell.confidence` for badges |
| `components/VirtualizedCoverageMatrix.tsx` | Modify | Render section headers in virtualized layout |
| `server/src/services/unifiedComparison/__tests__/*` | Modify | Update assertions for v2 shape and derived confidence |
| `server/src/evaluation/__tests__/*` | Create | Test baseline matching and match-rate guard |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Alias normalization, section assignment, confidence formula | Vitest with parameterized inputs |
| Unit | Schema v2 validation and v1 backward compatibility | Zod schema tests in `comparisonSchema.test.ts` |
| Unit | Prompt builder v2 template and v1 fallback | Assert prompt contains suggested sub-rows and flag branching |
| Integration | Parser end-to-end with markdown/JSON/CSV fixtures | Use mocked LLM outputs covering aliases, missing rows, and ambiguous labels |
| Integration | `matrixTransformer` section grouping | Assert header rows and data row order |
| Integration | Feature flag toggle | Enable/disable `granularComparisonSchema` and verify v2/v1 path |
| E2E | Extraction quality evaluation match rate >= 90% | Run Vitest harness against 3-quote fixture baseline |

## Migration / Rollout

1. Add feature flag defaulting to `false`; deploy with no behavior change.
2. Enable in staging; regenerate extraction-quality baseline and tune prompt/parser until match rate >= 90%.
3. Enable in production via rollout percentage; monitor fallback rate and parser warnings.
4. After one stable release, remove legacy v1 prompt/parser code path.

## Open Questions

- [ ] Should the alias dictionary be persisted in `taxonomy.json` or kept as a TypeScript constant?
- [ ] Does the UI need a separate toggle for technical vs. client view of granular rows?
- [ ] Which exact deductible value patterns should be considered valid for confidence scoring?
