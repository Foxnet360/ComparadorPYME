# Proposal: Unified Learning Loop Remediation

## Intent

The original change "Integrate Template Registry and Coverage Graph into Unified Comparison" shipped graph canonicalization and template-aware prompts behind rollout flags, but the 4R review of PRs 1-3 showed that the learning loop and cross-cutting integration were incomplete, and two runtime defects (measurement harness fragility and anonymous routing bias) were introduced. This remediation finishes Phase 4 (learning loop) and Phase 5 (integration) of the original change and fixes the 4R findings so the unified comparison path is resilient, correct for unauthenticated users, and able to learn from corrections.

## Scope

### In Scope

- **PR 1 — Measurement harness resilience**: Harden `templateHintMeasurement` so outliers and small samples do not spuriously disable template hints; fix p95 off-by-one; replace raw `ioredis` usage with the resilient `redisCache` wrapper; invalidate disable decisions when baselines are reset.
- **PR 2 — Anonymous routing fix**: Stop routing all unauthenticated traffic to the same deterministic bucket (`hashUserId('anonymous')`) by passing `undefined` from the controller and excluding `undefined` userIds from rollout hashing.
- **PR 3 — Learning loop wiring + integration**: Route `coverage_mapping` corrections directly into `coverageGraphService.learnCorrection` regardless of the legacy `graphLearningEnabled` flag; ensure learned edge weight is >= 0.7 and graph cache invalidation runs; surface `canonicalName`, `matchConfidence`, and `matchMethod` in `/api/analyze` reports; segment golden-set evaluation by `graphEnabled`/`templateHintsEnabled`.

### Out of Scope

- No new storage tables or schema migrations.
- No changes to the legacy per-quote pipeline or V1 schema behavior.
- No new UI redesign; only metadata exposure.

## Capabilities

### New Capabilities

- `template-hint-measurement-resilience`: Robust p95 measurement and baseline invalidation for template hint guardrails.
- `anonymous-rollout-guard`: Exclude unauthenticated users from percentage rollouts.
- `unified-learning-loop-wiring`: Direct correction-to-graph path for coverage mappings.
- `unified-integration-segmentation`: Surface canonical metadata and segment evaluation by slice flags.

### Modified Capabilities

- `template-aware-unified-prompt`: Measurement harness now uses `redisCache` and ignores small samples.
- `comparison-engine-adapter`: Handles `undefined` userId and propagates `graphEnabled`/`templateHintsEnabled` to the report.
- `coverage-semantic-graph`: `learnCorrection`/`addEdge` invalidate affected cache keys.
- `learning-engine`: `coverage_mapping` corrections bypass legacy flag gate.
- `golden-set-evaluation`: `runEvaluation` segments by slice flags.

## Approach

PR 1 first: harden the measurement harness before expanding template hints. PR 2 second: fix the anonymous routing bias before rolling any slice wider. PR 3 third: wire the learning loop and integrate the adapter output into the report and evaluation. Keep each PR bounded to a single rollback boundary.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/templateHintMeasurement.ts` | Modified | Minimum sample size, p95 fix, baseline invalidation, `redisCache` wrapper |
| `server/src/controllers/analysisController.ts` | Modified | Pass `undefined` when unauthenticated |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Exclude `undefined` userIds; propagate flags |
| `server/src/services/learningEngine.ts` | Modified | Bypass `graphLearningEnabled` for `coverage_mapping` corrections |
| `server/src/services/coverageGraphService.ts` | Modified | Cache invalidation in `learnCorrection`/`addEdge` |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Surface `graphEnabled`/`templateHintsEnabled` in `adapterResult` |
| `server/src/scripts/runEvaluation.ts` | Modified | Segment by slice flags |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| p95 off-by-one masks real cost spike | Med | Add unit tests for small N; require min sample size |
| Anonymous users silently bucketed to same rollout | Low-Med | Regression test with `undefined` userId |
| Cache invalidation misses learned mappings | Low | Unit tests assert invalidation keys are deleted |
| Report consumers break on new metadata | Low | Add optional fields only |

## Rollback Plan

PR 1: revert `templateHintMeasurement.ts` and its tests. PR 2: revert `analysisController.ts` and adapter changes. PR 3: revert `learningEngine.ts`, `coverageGraphService.ts`, adapter/report changes, and `runEvaluation.ts`. No migration; cached results remain valid.

## Dependencies

- Existing Redis-backed `redisCache` wrapper.
- Existing `coverageGraphService` and `templateRegistryService`.
- Existing `runEvaluation` golden-set harness.

## Success Criteria

- [ ] PR 1: `templateHintMeasurement` ignores N < 10, p95 is correct for small N, baseline reset clears disable decisions, no raw `ioredis` calls remain.
- [ ] PR 2: Unauthenticated requests receive `graphEnabled=false` and `templateHintsEnabled=false` when rollout requires user hashing.
- [ ] PR 3: `coverage_mapping` correction creates or updates a `learned` edge with weight >= 0.7 and invalidates graph cache; `/api/analyze` reports include `canonicalName`, `matchConfidence`, and `matchMethod`; `runEvaluation` segments results by `graphEnabled`/`templateHintsEnabled`.
- [ ] All changed services pass unit and integration tests; backend typecheck and format checks pass.
