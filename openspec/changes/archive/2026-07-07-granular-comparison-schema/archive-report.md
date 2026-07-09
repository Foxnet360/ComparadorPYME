# Archive Report — Granular Comparison Schema

**Change**: granular-comparison-schema  
**Archived**: 2026-07-07  
**Artifact store**: hybrid (OpenSpec files + Engram persistence)  
**Archive path**: `openspec/changes/archive/2026-07-07-granular-comparison-schema/`  
**Archive status**: complete

---

## Final Artifacts Update (2026-07-09)

On **2026-07-09**, the final `apply-progress.md` and `verify-report.md` artifacts from the Phase 7 re-verification batch were merged into this archive, overwriting the older versions to reflect the complete TDD work unit and the final verified state.

---

## Engram Observation IDs

| Artifact | Observation ID | Topic |
|----------|---------------|-------|
| proposal | #303 | `sdd/granular-comparison-schema/proposal` |
| spec | #304 | `sdd/granular-comparison-schema/spec` |
| design | #305 | `sdd/granular-comparison-schema/design` |
| tasks | #306 | `sdd/granular-comparison-schema/tasks` |
| apply-progress | #307 | `sdd/granular-comparison-schema/apply-progress` |
| verify-report | *not persisted separately* | `sdd/granular-comparison-schema/verify-report` |
| archive-report | #308 (updated 2026-07-09) | `sdd/granular-comparison-schema/archive-report` |

*Note: The verify-report was produced as an OpenSpec file. A separate Engram observation for the verify-report topic was not found; the report content is preserved in the archived `verify-report.md` and the structured bugfix observation #310 records the post-verification structured deductible extraction fix.*

---

## Task Completion Gate

- **Total tasks**: 27 (20 baseline tasks + 7 Phase 7 fresh review fix tasks)
- **Completed**: 27
- **Incomplete**: 0
- **Gate result**: PASS

All implementation tasks in `tasks.md` and Phase 7 re-verification tasks are marked `[x]`. The task artifact reflects the final state before archiving.

---

## Verification Verdict

- **Verdict**: `PASS WITH WARNINGS`
- **Critical issues**: None
- **Warnings acknowledged**: Dedicated exclusive-coverages section for v2 is grouped under `OTROS`; tooltip canonical-name/match-method detail is a UI gap; some changed files fall below 80% coverage; pre-existing frontend type-check and lint warnings remain; worker environment teardown warning observed in full backend tests.
- **Archive decision**: Proceed. Warnings are cosmetic/pre-existing and do not block archive per the orchestrator's explicit instruction.

---

## Delta Spec Sync to Main Specs

| Domain | Action | Details |
|----------|--------|---------|
| `unified-comparison-extraction` | Updated | 2 modified requirements (Single-call multimodal comparison, JSON schema validation); 5 added requirements (Alias normalization, Section assignment, Derived per-cell confidence, Feature flag gating, Backward compatibility); preserved Flat table parser and Result caching requirements. |
| `extraction-quality-evaluation` | Updated | 4 modified requirements (Fixed quote set baseline, Tool path comparison, Cell-level metric, Regression guard). |
| `unified-coverage-matrix` | Updated | 2 modified requirements (Matriz de comparación unificada, Indicadores de confianza visual); 1 added requirement (Encabezado de sección como fila propia); preserved ARIA, virtualización, and responsive design requirements. |
| `row-grouped-comparison-matrix` | Updated | 3 modified requirements (Matrix transformation to flat row schema, Exclusive coverages mapping in matrix, Unified React layout rendering); 1 added requirement (Section-aware export preservation). |

---

## Archive Contents

- `proposal.md` ✅
- `spec.md` ✅
- `specs/` ✅
  - `extraction-quality-evaluation/spec.md` ✅
  - `row-grouped-comparison-matrix/spec.md` ✅
  - `unified-comparison-extraction/spec.md` ✅
  - `unified-coverage-matrix/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (27/27 tasks complete)
- `apply-progress.md` ✅ (updated with Phase 6 & Phase 7)
- `verify-report.md` ✅ (updated with Phase 7 fresh re-verification)
- `exploration.md` ✅
- `archive-report.md` ✅ (this file - updated 2026-07-09)

---

## Source of Truth Updated

The following main specs now reflect the new granular comparison schema behavior:

- `openspec/specs/unified-comparison-extraction/spec.md`
- `openspec/specs/extraction-quality-evaluation/spec.md`
- `openspec/specs/unified-coverage-matrix/spec.md`
- `openspec/specs/row-grouped-comparison-matrix/spec.md`

---

## SDD Cycle Completion

The change has been fully planned, implemented, verified, and archived. The stacked PRs have been merged and finalized.

---

## Intentional Archive Notes

- No destructive deltas were merged; all preserved requirements were intentionally kept because they were not mentioned in the delta spec.
- Feature flag backward compatibility is preserved per `openspec/config.yaml` archive rules.
- The archived audit trail contains no stale unchecked implementation tasks.
