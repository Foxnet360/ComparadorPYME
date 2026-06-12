# Archive Report: mejora-extraccion-coberturas

**Change**: Improve Coverage, Deductible, and Condition Extraction
**Archived**: 2026-06-12
**Mode**: hybrid (OpenSpec + Engram)
**Status**: success

## Source Artifacts

### Engram Observations
| Artifact | Observation ID |
|----------|---------------|
| proposal | #97 |
| spec | #98 |
| design | #99 |
| tasks | #100 |
| apply-progress | #110 |
| verify-report | #126 |

### OpenSpec Files
| Artifact | Path |
|----------|------|
| proposal | openspec/changes/mejora-extraccion-coberturas/proposal.md |
| spec | openspec/changes/mejora-extraccion-coberturas/spec.md |
| design | openspec/changes/mejora-extraccion-coberturas/design.md |
| tasks | openspec/changes/mejora-extraccion-coberturas/tasks.md |
| apply-progress | openspec/changes/mejora-extraccion-coberturas/apply-progress.md |
| verify-report | openspec/changes/mejora-extraccion-coberturas/verify-report.md |

## Task Completion Gate

- Total tasks: 32
- Complete: 32
- Incomplete: 0
- OpenSpec `tasks.md` and Engram tasks observation are synchronized.
- Result: PASS

## Verification Status

- Verdict: PASS WITH WARNINGS
- CRITICAL issues: 0
- Change-related tests: 204 passed / 0 failed (28 files)
- Type-check: passed (`npm run typecheck:backend`)
- Golden-set evaluation: 30/30 fixtures evaluated, 0 regressions
- Spec compliance matrix: 28/28 scenarios compliant

## Specs Synced

### New Main Specs
- `openspec/specs/insurer-template-registry/spec.md`
- `openspec/specs/layout-aware-quote-extraction/spec.md`
- `openspec/specs/coverage-semantic-graph/spec.md`

### Updated Main Specs
- `openspec/specs/format-family-detection/spec.md`
- `openspec/specs/semantic-coverage-matching/spec.md`
- `openspec/specs/coverage-post-normalization/spec.md`
- `openspec/specs/deductible-semantic-parser/spec.md`
- `openspec/specs/learning-engine/spec.md`

## Archive Location

`openspec/changes/archive/2026-06-12-mejora-extraccion-coberturas/`

## Residual Risks

1. **Pre-existing test suite failures**: 27 failed test files and 11 failed tests are unrelated to this change (missing env vars, jest references, parse errors, missing fixtures, module resolution errors). CI is not fully green.
2. **Delta-change coverage on legacy paths**: Whole-file coverage on existing modified services (`learningEngine.ts`, `semanticMatcher.ts`, `pdfExtractor.ts`, `thesaurusMapper.ts`, `quoteProcessingService.ts`) is below 80% because tests cover only the new graph/template paths.
3. **Linter warnings**: Unused `createMetricCollector` imports and an unread `pageSuccessCount` variable were introduced by observability work.
4. **Golden-set echo runner**: The default `npm run evaluate:golden` echo runner returns perfect scores as a harness sanity check; real-world accuracy must be measured with a runner that invokes the full extraction pipeline.
5. **Delivery remains open**: The stacked PR chain (slices 1–7) still needs to be created and reviewed.

## Next Recommended Phase

`branch-pr` — create stacked pull requests per the `auto-forecast` chained PR plan.
