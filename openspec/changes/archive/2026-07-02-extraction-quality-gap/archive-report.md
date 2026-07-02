# Archive Report: Close the extraction-quality gap with direct-LLM comparison table

**Change**: extraction-quality-gap  
**Mode**: hybrid (OpenSpec files + Engram persistence)  
**Archived**: 2026-07-02  
**Archive path**: `openspec/changes/archive/2026-07-02-extraction-quality-gap/`  
**Status**: Archived with warnings  

---

## Source Artifact Traceability

| Artifact | Engram observation ID | OpenSpec file |
|----------|----------------------|---------------|
| Exploration | #285 | `exploration.md` |
| Proposal | #286 | `proposal.md` |
| Spec | #287 | `specs/*/spec.md` |
| Design | #288 | `design.md` |
| Tasks | #289 | `tasks.md` |
| Apply progress | #290 | `apply-progress.md` |
| Verify report | #293 | `verify-report.md` |

---

## Task Completion Gate

All 19 implementation tasks across 7 phases are marked complete in both the Engram tasks observation and `tasks.md`:

- Phase 1: Foundation — 3/3 ✅
- Phase 2: Flat Table Parser — 3/3 ✅
- Phase 3: Unified Engine Wiring — 3/3 ✅
- Phase 4: Fallback Batch Service — 3/3 ✅
- Phase 5: Adapter Routing & Integration — 4/4 ✅
- Phase 6: Evaluation Harness — 3/3 ✅
- Phase 7: Regression & Cleanup — 3/3 ✅

No stale unchecked implementation tasks remain in the persisted artifact.

---

## Delta Spec Sync

| Domain | Main spec action | Requirements changed |
|--------|------------------|----------------------|
| `comparison-engine-adapter` | Updated | 2 modified (Feature flag control, Legacy fallback) |
| `unified-comparison-extraction` | Updated | 2 modified (Single-call multimodal comparison, JSON schema validation), 1 added (Flat table parser) |
| `quote-analysis-v2` | Updated | 2 modified (Text-based quote analysis, Unified engine integration) |
| `extraction-quality-evaluation` | Created | New capability with 4 requirements |

All unmentioned requirements in existing main specs were preserved.

---

## Archive Contents

- `proposal.md` ✅
- `exploration.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (19/19 complete)
- `apply-progress.md` ✅
- `verify-report.md` ✅
- `specs/` ✅
  - `comparison-engine-adapter/spec.md`
  - `extraction-quality-evaluation/spec.md`
  - `quote-analysis-v2/spec.md`
  - `unified-comparison-extraction/spec.md`
- `archive-report.md` ✅

---

## Verification Summary

**Verdict from verify-report**: PASS WITH WARNINGS

- Type check: ✅ Passed (`npm run typecheck:backend`)
- Tests: ✅ 1051 passed / 0 failed / 8 skipped (`npm test`)
- TDD compliance: ✅ 6/6 checks passed
- Assertion quality: ✅ All assertions verify real behavior
- Spec compliance: 13/20 scenarios fully compliant, 7 partial (environment-limited integration paths or log-format details)

### Non-blocking warnings recorded

1. Lint error in `flatTableParser.ts:138` (unnecessary escape character `\-`).
2. Unused imports in `analysisController.ts`, `quoteProcessingService.batch.test.ts`, `unifiedComparisonEngine.test.ts`.
3. Adapter log tokens do not exactly match spec wording `routing=unified, source=default` / `routing=legacy, source=flag`.
4. Timeout wrapper rejects the promise but does not abort the underlying Gemini request via `AbortController`.
5. Integration regression paths skip when `GEMINI_API_KEY` or real fixture PDFs are missing.
6. Several changed files have coverage below 80% (mostly deep-mode/legacy/error branches and the API-dependent evaluation harness).
7. Unhandled `EnvironmentTeardownError` in `quoteProcessingService.test.ts` during coverage run.

No CRITICAL issues were reported. Archive proceeds with warnings documented per the OpenSpec intentional-with-warnings policy.

---

## Source of Truth Updated

The following main specs now reflect the new behavior:

- `openspec/specs/comparison-engine-adapter/spec.md`
- `openspec/specs/unified-comparison-extraction/spec.md`
- `openspec/specs/quote-analysis-v2/spec.md`
- `openspec/specs/extraction-quality-evaluation/spec.md` (new)

---

## SDD Cycle State

The change has been fully planned, implemented, verified, and archived. Ready for the next change.

---

## Notes

- Archive executed under hybrid mode: Engram observations remain active for traceability and the OpenSpec change folder has been moved to the dated archive.
- No PRs or commits were created; archive is a documentation/spec sync operation only.
- `rules.archive` from `openspec/config.yaml` applied: destructive deltas were reviewed and non-destructive; feature-flag backward compatibility was preserved (legacy `FEATURE_USE_UNIFIED_COMPARISON_ENGINE` alias kept).
