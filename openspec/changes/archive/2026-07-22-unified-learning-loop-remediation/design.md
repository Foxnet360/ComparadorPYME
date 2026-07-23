# Design: Unified Learning Loop Remediation

## Technical Approach

This change delivers three stacked PRs that fix 4R review findings and complete the original change's Phase 4 (learning loop) and Phase 5 (integration). PR 1 hardens the template-hint measurement harness so it does not disable hints on tiny samples or single outliers. PR 2 fixes anonymous routing by passing `undefined` from the controller and treating `undefined` userIds as ineligible for rollout. PR 3 wires the learning loop so `coverage_mapping` corrections always create graph edges, ensures cache invalidation, and surfaces canonical metadata in the analysis report and evaluation segmentation.

## Architecture Decisions

| Decision | Options | Tradeoffs | Choice |
|---|---|---|---|
| Minimum sample size for `shouldDisable` | A) hardcode N=10; B) configurable per-insurer | A is simpler and matches 4R finding; B adds env surface | A — hardcode 10 in `shouldDisable` |
| Baseline invalidation | A) clear disable cache in `setBaseline`; B) add TTL | A is immediate and testable; B adds staleness risk | A — `setBaseline` removes the per-insurer disable entry |
| p95 calculation | A) fix off-by-one in `percentile`; B) switch to a library | A is minimal; B adds dependency | A — adjust index calculation |
| Raw ioredis usage | A) replace with `redisCache` wrapper; B) keep raw with retries | A aligns with project standard and adds resilience | A — use `redisCache` for all Redis operations |
| Anonymous user routing | A) pass `undefined` from controller; B) special-case `anonymous` string | A is clean and explicit; B leaves a magic string in the engine | A — `analysisController` passes `undefined` when no user is authenticated |
| Exclude `undefined` from rollout | A) adapter checks before hashing; B) `hashUserId` returns out-of-range | A is explicit; B is obscure | A — `isSliceEnabled` returns false when `userId` is `undefined` |
| Learning loop bypass | A) always route `coverage_mapping` to `learnCorrection`; B) keep `graphLearningEnabled` gate for unified path | A fulfills the original intent; B leaves the graph dormant for unified corrections | A — `applyCorrection` calls `coverageGraphService.learnCorrection` directly for `coverage_mapping` |
| Cache invalidation scope | A) invalidate `graph:query:*` and `graph:deductible:*` patterns; B) flush entire graph cache | A is surgical; B is heavy-handed | A — delete matching keys in `learnCorrection` and `addEdge` |
| Report metadata | A) pass flags from adapter to report builder; B) infer inside report builder | A is explicit and testable | A — `adapterResult` includes `graphEnabled`/`templateHintsEnabled`; `matrixRowsToComparisonReport` surfaces `canonicalName`, `matchConfidence`, `matchMethod` |
| Evaluation segmentation | A) extend `runEvaluation` flags; B) post-process output | A keeps the segmentation in the source harness | A — pass `graphEnabled`/`templateHintsEnabled` into `runEvaluation` and segment results |

## Data Flow

### PR 1: Measurement Harness

```
recordObservation(insurer, tokens, latencyMs)
        │
        ▼
redisCache.zadd(samplesKey, timestamp, value)
        │
        ▼
shouldDisable(insurer)
        │
        ├── sampleCount < 10 ──→ disabled=false
        │
        └── sampleCount >= 10
                 │
                 ▼
          percentile(samples, 0.95)  [fixed index]
                 │
                 ▼
          compare vs baseline + 15%
                 │
                 ▼
          set disable flag in redisCache Hash + TTL
                 │
                 ▼
setBaseline(insurer, baseline)
        │
        ▼
  redisCache.hdel(disableKey)   // clears any prior disable decision
```

### PR 2: Anonymous Routing

```
POST /api/analyze (no Authorization header)
        │
        ▼
analysisController.uploadAndAnalyze(req, res)
        │
        ├── req.user is undefined
        │        │
        │        ▼
        │  comparisonEngineAdapter.generateComparison(pdfPaths, undefined)
        │        │
        │        ▼
        │  isSliceEnabled(undefined, rollout) → false
        │        │
        │        ▼
        │  graphEnabled=false, templateHintsEnabled=false
```

### PR 3: Learning Loop + Integration

```
POST /api/analyze
        │
        ▼
unifiedComparisonEngine.compare(pdfPaths, options)
        │
        ▼
flatTableParser.parseV2(rawText, { graphEnabled })
        │
        ▼
rows enriched with canonicalName, canonicalId, matchConfidence, matchMethod
        │
        ▼
comparisonEngineAdapter.generateComparison
        │
        ├── returns graphEnabled/templateHintsEnabled
        │
        ▼
analysisController
        │
        ▼
matrixRowsToComparisonReport(adapterResult)
        │
        ▼
coverages[i] includes canonicalName, matchConfidence, matchMethod

learningEngine.saveCorrection(correction)
        │
        ▼
applyCorrection(correction)
        │
        ├── correction.type === 'coverage_mapping'
        │        │
        │        ▼
        │  coverageGraphService.learnCorrection(raw, canonical, insurer, 'pyme')
        │        │
        │        ▼
        │  coverageGraphService.addEdge(...)   // learned edge, weight >= 0.7
        │        │
        │        ▼
        │  invalidateCache(raw, insurer, 'pyme')
        │
        └── other correction types use legacy path
```

## File Changes

| File | Action | Description |
|---|---|---|
| `server/src/services/unifiedComparison/templateHintMeasurement.ts` | Modify | Enforce N >= 10 before computing p95; fix `percentile` index; clear disable entry in `setBaseline`; use `redisCache` wrapper |
| `server/src/services/unifiedComparison/__tests__/templateHintMeasurement.test.ts` | Modify | Add regression tests for N=1 outlier, small-N p95, baseline invalidation |
| `server/src/controllers/analysisController.ts` | Modify | Pass `undefined` instead of a string at line 134 when `req.user` is absent |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modify | `isSliceEnabled` returns false for `undefined` userId; include `graphEnabled`/`templateHintsEnabled` in `ComparisonAdapterResult` |
| `server/src/services/unifiedComparison/__tests__/comparisonEngineAdapter.test.ts` | Modify | Add anonymous routing regression test; assert flag propagation |
| `server/src/services/learningEngine.ts` | Modify | `applyCorrection` routes `coverage_mapping` corrections directly to `coverageGraphService.learnCorrection` bypassing `graphLearningEnabled` |
| `server/src/services/__tests__/learningEngine.test.ts` | Modify | Add test: `coverage_mapping` correction writes graph edge with flag false; first human correction weight >= 0.7 |
| `server/src/services/coverageGraphService.ts` | Modify | `learnCorrection` and `addEdge` invalidate `graph:query:*` and `graph:deductible:*` cache keys |
| `server/src/services/__tests__/coverageGraphService.test.ts` | Modify | Add cache invalidation regression test |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modify | Propagate `graphEnabled`/`templateHintsEnabled` to `adapterResult` |
| `server/src/controllers/analysisController.ts` | Modify | Pass adapter flags to `matrixRowsToComparisonReport` |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modify | Surface `canonicalName`, `matchConfidence`, `matchMethod` from matrix rows into report `coverages` |
| `server/src/scripts/runEvaluation.ts` | Modify | Segment golden-set results by `graphEnabled` and `templateHintsEnabled` |
| `server/src/scripts/__tests__/runEvaluation.test.ts` | Modify | Add segmentation test |

## Interfaces / Contracts

```typescript
// comparisonEngineAdapter.ts
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

// templateHintMeasurement.ts
export interface TemplateHintMeasurementHarness {
  recordObservation(insurer: string, tokenCount: number, latencyMs: number): Promise<void>;
  shouldDisable(insurer: string): Promise<{ disabled: boolean; reason?: 'token_increase' | 'latency_increase' }>;
  setBaseline(insurer: string, baseline: { tokens: number; latencyMs: number }): Promise<void>;
}

// analysisController.ts — report coverage metadata
interface ReportCoverage {
  // existing fields...
  canonicalName?: string;
  matchConfidence?: number;
  matchMethod?: string;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `templateHintMeasurement` | Mock `redisCache`; feed deterministic samples; assert N < 10 never disables; assert p95 for small N is not the max; assert `setBaseline` clears disable entry |
| Unit | `comparisonEngineAdapter` anonymous routing | Mock `hashUserId`; assert `undefined` userId yields false; assert authenticated userId still participates in rollout |
| Unit | `learningEngine` correction routing | Stub `coverageGraphService.learnCorrection`; assert `coverage_mapping` corrections call it even when `graphLearningEnabled` is false; assert weight >= 0.7 |
| Unit | `coverageGraphService` cache invalidation | Mock Redis; assert `learnCorrection` and `addEdge` delete matching `graph:query:*` and `graph:deductible:*` keys |
| Integration | `/api/analyze` report metadata | Stub external services; assert response includes `canonicalName` and raw labels; assert `matchConfidence` and `matchMethod` present |
| Integration | `runEvaluation` segmentation | Provide golden set with mixed flags; assert output contains accuracy buckets for `graphEnabled`/`templateHintsEnabled` combinations |
| Golden set | Slice segmentation | `evaluate:golden` reports accuracy separately for graph/template-hint slices |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The change stays within the Node/Express service layer, Redis, and Supabase.

## Migration / Rollout

No migration required. Rollout plan:

1. Deploy PR 1 with measurement harness fixes; monitor no spurious disable events.
2. Deploy PR 2 before increasing any rollout percentage; verify anonymous requests are not bucketed.
3. Deploy PR 3; enable a small graph/template rollout; verify corrections create edges and reports surface canonical metadata.
4. Rollback per PR as described in the proposal.

## Open Questions

None — this is a remediation with fixed scope.
