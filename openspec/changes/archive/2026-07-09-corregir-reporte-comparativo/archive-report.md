# Archive Report: Corregir Reporte Comparativo (V2 Engine Integration)

**Change**: `corregir-reporte-comparativo`
**Date**: 2026-07-09
**Archived to**: `openspec/changes/archive/2026-07-09-corregir-reporte-comparativo/`
**Status**: `SUCCESS`
**Execution Mode**: `auto`

---

## 1. Goal & Accomplishments

The goal of this change was to correct the integration of the unified single-call comparison engine (V2) in the `comparadorpyme` project. The previous implementation bypassed critical core systems (authentication, dynamic scoring, normalizers, risk audits) and left the Client/Técnico toggle non-functional.

Through a series of 5 chained PRs (merged into `main` via PR #30), we successfully integrated all core services with the V2 engine:
1. **PR #25**: Secured `/api/comparison/unified` using `optionalAuthMiddleware`, synced extracted companies and profiles, and enabled Row-Level Security (RLS) policies on 14 database tables.
2. **PR #26**: Implemented and wired `parseColombianCurrency`, a Colombian decimal-aware utility to parse COP formats correctly (e.g., `$1.134.400,00` to `1134400.00`).
3. **PR #27**: Implemented semantic ontology mapping utilizing `coverageNormalizer` and `thesaurusMapper` to standardize raw labels into canonical names/categories. Unmapped coverages are grouped under an "unmapped" category, and billing rows are filtered out.
4. **PR #28**: Replaced hardcoded scores with dynamic rule-based scoring and risk auditing using `quoteScorer` and `quoteBasedAuditor`.
5. **PR #29**: Developed polished UI view modes, binding the Client/Técnico view mode toggle to hide/show technical details and citations, and parsing semicolon-delimited deductibles into clean stacked list items.

All features are now active, fully functional, and secure on the `main` branch.

---

## 2. Deviations & Reconciliation

* **Deviations**: None. All 5 planned phases and implementation tasks were fully delivered as defined in the original specifications.
* **Reconciliation**: All 10 implementation tasks in the tasks artifact were verified as complete and marked accordingly with no unchecked items remaining.

---

## 3. Specs Synced

The following main specification was updated to reflect the new behavior:
- `openspec/specs/unified-comparison-extraction/spec.md`: Appended the complete set of specifications under the section `## Delta from change: corregir-reporte-comparativo`.

---

## 4. Verification & Testing Evidence

* **Linter & Formatting**: Clean run with zero errors across frontend and backend.
* **Type checking**: Passed without any errors on both backend and frontend.
* **Test Suite**: A comprehensive suite of **1,166 tests across 127 files** passed with a **100% success rate**. Specific new unit tests were verified:
  - `currencyParser.test.ts` (6/6 passing)
  - `analysisController.test.ts` (8/8 passing)
  - `DeductibleBadge.test.tsx` (5/5 passing)
  - `UnifiedCoverageMatrix.test.tsx` (9/9 passing)

---

## 5. Traceability & Persistent Memory Audit

Below are the Engram persistent memory references associated with this change:

| Artifact | Memory ID | Sync ID | Title / Topic Key |
| :--- | :--- | :--- | :--- |
| **Proposal** | `#340` | `obs-d42ada44debfbb9b` | `Proposal: Corregir Reporte Comparativo` |
| **Spec** | `#341` | `obs-0a7fbfbf0f00765b` | `Spec: Corregir Reporte Comparativo` |
| **Design** | `#343` | `obs-6aff3676fe8e110e` | `Design: Corregir Reporte Comparativo` |
| **Tasks** | `#345` | `obs-b30b873242218361` | `Tasks: Corregir Reporte Comparativo` |
| **Verification** | `#351` | `obs-f0396f41ed8e2d91` | `Verified corregir-reporte-comparativo (V2 Engine Fixes)` |
| **PR 2 Summary** | `#347` | `obs-f2bf9d9328fb9b9d` | `Session summary: comparadorpyme (PR 2)` |
| **PR 3 Summary** | `#348` | `obs-247904cdf765a2c6` | `Session summary: comparadorpyme (PR 3)` |
| **PR 4 Summary** | `#349` | `obs-a6129a3ac461ceba` | `Session summary: comparadorpyme (PR 4)` |
| **PR 5 Summary** | `#350` | `obs-e720c0d6f31f1ae2` | `Session summary: comparadorpyme (PR 5)` |
