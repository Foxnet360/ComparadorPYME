# Design: Integrate Template Registry and Coverage Graph into Unified Comparison

## Technical Approach

Add three independent slices behind percentage-rollout feature flags. Slice 1 runs post-parse inside `flatTableParser` using the dormant `coverageGraphService`; it canonicalizes V2 row labels and links deductibles without mutating the raw text visible to users. Slice 2 runs pre-LLM inside `unifiedComparisonEngine.compare`: it matches uploaded PDFs with `templateRegistryService.matchTemplate` and appends insurer-specific `promptAddon` blocks to the V2 prompt. Slice 3 routes `learningEngine.saveCorrection` corrections into `coverageGraphService.learnCorrection` and invalidates the graph cache. All slices are gated by the adapter, are disabled on V1 schema paths, and fall back to the generic V2 prompt / alias-only path when disabled.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Where to hook graph canonicalization | A) Inside `parseV2` / `buildV2Result`; B) new transformer after parse | A keeps parser/validator coupled; B adds a pass but keeps schema validation intact | A — extend `buildV2Result` after `normalizeAlias` so `FlatComparisonSchema` validation still runs on the same shape |
| How to keep raw labels visible | A) Store canonical in metadata; B) overwrite then keep original in `rawText` | B breaks existing consumers that read `row.label`; A is non-breaking | A — add `canonicalName`, `canonicalId`, `canonicalSource`, `matchConfidence` to `FlatComparisonRowV2` metadata only |
| Prompt injection | A) `comparisonPromptBuilder.buildV2ComparisonPrompt(context, addons)`; B) `buildV2ComparisonPrompt` concatenates after | A changes the public signature everywhere; B is localized to the builder | B — add optional `templateAddons?: string[]` parameter with default no-op |
| Cost/latency guardrail | A) per-request inline measurement; B) background cron with Redis/ZSet | A is simple but request-blocking; B requires infra | A — inline per-insurer measurement harness backed by Redis `SortedSet`/`Hash`, evaluated at request time; disable flag stored in-memory with TTL |
| Rollout hashing | A) reuse `UnifiedComparisonFeatureFlag.hashUserId`; B) new hash | Reuse avoids divergent user buckets | A — reuse existing deterministic hash |
| V1 schema guard | A) adapter disables slices when `granularComparisonSchema=false`; B) engine ignores flags internally | A is explicit and observable; B hides the guard | A — explicit early guard in `comparisonEngineAdapter.generateComparison` |
| Learning loop | A) sync in `saveCorrection`; B) async queue | A keeps <24h SLA simple; B needs worker | A — call `coverageGraphService.learnCorrection` directly in `applyCorrection`, cache invalidation follows write |

## Data Flow

```
POST /api/analyze
    │
    ▼
analysisController.uploadAndAnalyze
    │
    ▼
comparisonEngineAdapter.generateComparison(pdfPaths, userId)
    │ 1. V1 schema guard? → force graph/template=false
    │ 2. hash(userId) vs rollout % for graphEnabled / templateHintsEnabled
    │ 3. log routing + flags
    ▼
unifiedComparisonEngine.compare(pdfPaths, { granularComparisonSchema, graphEnabled, templateHintsEnabled })
    │
    ├── Template match (if V2 + templateHintsEnabled)
    │   templateRegistryService.matchTemplate({ text, pages, domain:'pyme' })
    │   → per-insurer promptAddon collected
    │
    ├── Build prompt
    │   comparisonPromptBuilder.buildV2ComparisonPrompt(context, templateAddons)
    │
    ├── Call Gemini → raw JSON
    │
    └── Parse with flatTableParser.parseV2
        │
        └── Graph canonicalize (if graphEnabled)
            coverageGraphService.query(row.label, { insurer, domain:'pyme' })
            coverageGraphService.queryDeductible(rawText, { insurer })
            → row.canonicalName / canonicalId / canonicalSource / matchConfidence
            → cell.deductible.appliesTo
    ▼
matrixTransformer.flatResultToMatrixRowsV2(result)
    sorts rows by canonicalId order, renders original label
```

## File Changes

| File | Action | Description |
|---|---|---|
| `server/src/config/featureFlags.ts` | Modify | Add `useUnifiedGraphCanonicalization`, `useUnifiedTemplateHints`, `useUnifiedTemplateHintsBbva/Sbs/Mapfre`; env parsing for `_ROLLOUT` suffixes and cost-guard disable |
| `server/src/services/unifiedComparison/featureFlagService.ts` | Modify | Export `hashUserId` helper so adapter can reuse it; add optional per-insurer guard methods |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modify | Evaluate graph/template slice rollouts; add V1 schema guard; return `graphEnabled`, `templateHintsEnabled`; keep legacy fallback untouched |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modify | Accept `graphEnabled`/`templateHintsEnabled` in `CompareOptions`; call template matching; inject addons; pass flags to parser |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modify | `buildV2ComparisonPrompt(context, templateAddons?)` appends labeled insurer addons |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modify | After `normalizeAlias`, query graph for each row and deductible; add canonical metadata; keep raw label/value unchanged; alias fallback for uncovered insurers |
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modify | Add optional `canonicalName`, `canonicalId`, `canonicalSource`, `matchConfidence` to `FlatComparisonRowSchemaV2`; add optional `appliesTo` array to `StructuredDeductibleSchema` |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modify | Sort rows within each section by `canonicalId` when present; use `row.label` for display |
| `server/src/services/coverageGraphService.ts` | Modify | `query` returns `GraphQueryResult & { rawName: string }`; `queryDeductible` ranks by insurer specificity; `learnCorrection`/`addEdge` invalidate cache |
| `server/src/services/templateRegistryService.ts` | Modify | Expose `matchTemplate` return `insurer` field explicitly; ensure `promptAddon` is never undefined |
| `server/src/services/learningEngine.ts` | Modify | `applyCorrection` always calls `updateGraph`; human corrections produce `learned` edge weight >= 0.7; remove `graphLearningEnabled` gate for the unified path (still used by legacy path) |
| `server/src/services/unifiedComparison/templateHintMeasurement.ts` | Create | Per-insurer token and latency harness with Redis-backed p95 calculation and `>15%` disable trigger |
| `server/src/services/unifiedComparison/__tests__/templateHintMeasurement.test.ts` | Create | Unit tests for the harness with mocked Redis and deterministic samples |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Create | Rollout hashing, V1 guard, fallback, and flag propagation tests |
| `server/src/controllers/analysisController.ts` | Modify | Pass adapter flags through to `matrixRowsToComparisonReport` so report can expose `canonicalName` and `matchMethod` |

## Interfaces / Contracts

```typescript
// comparisonSchema.ts additions
export const FlatComparisonRowSchemaV2 = z.object({
  label: z.string().min(1),
  section: z.nativeEnum(SchemaSection).optional(),
  canonicalName: z.string().optional(),      // canonical coverage label
  canonicalId: z.string().optional(),        // kebab-case id for ordering
  canonicalSource: z.enum(['graph', 'alias', 'uncanonicalized']).optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
  cells: z.array(FlatComparisonCellSchemaV2),
});

export const StructuredDeductibleSchema = z.object({
  percentage: z.number().optional(),
  minimum: z.number().optional(),
  currency: z.string().optional(),
  type: z.enum([...]).optional(),
  appliesTo: z.array(z.string()).optional(), // canonical coverage ids
});

// comparisonEngineAdapter.ts additions
export interface ComparisonAdapterResult {
  matrix: MatrixRow[];
  engine: 'unified' | 'fallback';
  schemaVersion: 1 | 2;
  fallbackReason?: string;
  correlationId: string;
  quoteMetadata?: any[];
  graphEnabled?: boolean;
  templateHintsEnabled?: boolean;
}

// templateHintMeasurement.ts public API
export interface TemplateHintMeasurementHarness {
  recordObservation(insurer: string, tokenCount: number, latencyMs: number): Promise<void>;
  shouldDisable(insurer: string): Promise<{ disabled: boolean; reason?: 'token_increase' | 'latency_increase' }>;
  setBaseline(insurer: string, baseline: { tokens: number; latencyMs: number }): Promise<void>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `templateHintMeasurement` harness | Mock Redis; feed deterministic samples; assert p95 > 15% disables per-insurer flag and logs reason |
| Unit | `comparisonEngineAdapter` rollout | Mock `unifiedComparisonFlag.hashUserId` to return boundary values; assert `graphEnabled`/`templateHintsEnabled` flip at the threshold; assert V1 forces false |
| Unit | `flatTableParser` graph integration | Inject stub `coverageGraphService`; assert canonical metadata is attached and raw labels unchanged; assert alias fallback when graph empty |
| Unit | `coverageGraphService.query` rawName | Assert returned `rawName` matches input even when mappings empty |
| Integration | `unifiedComparisonEngine.compare` with template hints | Stub Gemini, template registry, and measurement harness; assert prompt contains labeled addon; assert generic prompt when no match |
| Integration | `learningEngine.saveCorrection` → graph edge | Use fake DB/cache for `coverageGraphService`; assert `learned` edge created with weight >= 0.7 and cache invalidation key deleted |
| Integration | `/api/analyze` end-to-end | Stub all external services; assert response includes `canonicalName` and raw labels preserved |
| Golden set | Accuracy + latency regression | `evaluate:golden` extended to segment by `graphEnabled`/`templateHintsEnabled`; measure S1 +15% accuracy, S2 -20% missing rows, p95 ≤ +25% |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change stays within the Node/Express service layer calling LLM and database services.

## Migration / Rollout

No migration required. Existing `coverage_graph_edges` and `template_registry` tables are reused. Rollout plan:

1. Deploy with `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=0` and `USE_UNIFIED_TEMPLATE_HINTS_ROLLOUT=0`.
2. Enable graph canonicalization to 5% of users → monitor `coverageGraph.hit` and golden-set accuracy.
3. Raise to 50% when S1 accuracy target is met.
4. Enable BBVA template hints at 5% → watch `templateHintMeasurement` guardrail; expand to SBS/MAPFRE if p95 token/latency stays below threshold.
5. Rollback: set any `_ROLLOUT=0` or the boolean flag to `false`; cached results remain valid.

## Open Questions

- [ ] Does the canonical 14 PYME category order already exist as a constant, or should we define `CANONICAL_COVERAGE_ORDER` in `comparisonPromptBuilder.ts` and reuse it in `matrixTransformer.ts`?
- [ ] Should the cost/latency baseline be auto-computed from the first N requests without hints, or loaded from a config/env var for deterministic guardrails?
- [ ] Are there existing `coverage_graph_edges` rows that use prefixes (`raw:`, `cat:`) for canonical targets? The `stripPrefix` logic must be preserved in `query` and `queryDeductible` to avoid double-prefixing when storing canonical IDs.
