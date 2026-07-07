# Proposal: Granular Comparison Schema

## Intent

Replace the rigid four-row comparison schema (`Bienes Asegurados`, `Deducibles`, `Prima con IVA`, `Forma de Pago`) with a granular, section-aware template. Sub-items such as Edificio, Contenidos, Mercancías, and per-coverage deductibles will appear as independent rows, matching the clarity users get when asking an LLM for a comparison table directly in chat. Confidence will no longer be hardcoded; it will be derived from extraction signals.

## Scope

### In Scope
- Define schema v2 for `FlatComparisonResult`: open row list, optional `section` per row, optional per-cell `confidence`, and a `schemaVersion` field.
- Replace the four-row prompt with a templated, granular prompt and alias normalization for common wording variants.
- Update `flatTableParser.ts` to map discovered labels to canonical rows and assign sections; keep unmatched rows in `extraRows`.
- Compute cell-level confidence from `notFound`, raw-text presence, alias match quality, and value-pattern validation.
- Update `matrixTransformer.ts` and the coverage matrix UI to render section headers and granular rows.
- Regenerate the extraction-quality baseline and matcher to align by canonical row label.
- Add feature-flag gating and a backward-compatible fallback to legacy schema v1.

### Out of Scope
- Fully free-form LLM output without any canonical template or alias normalization.
- New coverage taxonomy or ontology changes beyond the granular sub-rows listed above.
- Multi-call architecture changes; the comparison remains a single Gemini call.
- RAG evidence integration for individual granular cells.
- Excel/CSV export redesign beyond preserving existing data export.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `unified-comparison-extraction`: expand from fixed four rows to a granular, section-aware schema with alias normalization and schema versioning.
- `extraction-quality-evaluation`: baseline and matcher must support variable row counts and align cells by canonical row label instead of four fixed labels.
- `unified-coverage-matrix`: render section headers and granular rows instead of flattening everything under `INFORMACIÓN GENERAL`.
- `row-grouped-comparison-matrix`: preserve section grouping when transforming flat comparison output into `MatrixRow[]` rows.

## Approach

Adopt the templated hybrid approach recommended in exploration. Provide the LLM with a suggested section/sub-row template but explicitly allow it to include, omit, or rename rows. After parsing, normalize discovered labels to canonical sub-items via an expanded alias dictionary, assign each row a section, and keep unmatched rows as `extraRows`. The transformer and UI will render each section as a header row followed by its data rows. Confidence will be computed per-cell from extraction signals rather than hardcoded to `0.85`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modified | Drop `rows.length(4)`; add `section` and `confidence` metadata; add `schemaVersion`. |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modified | Replace four-row prompt with granular section template. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Expand aliases, variable row count, section assignment, per-cell confidence. |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modified | Group rows into sections with headers. |
| `components/UnifiedCoverageMatrix.tsx` / `VirtualizedCoverageMatrix.tsx` | Modified | Render section headers and granular rows. |
| `server/src/controllers/analysisController.ts` | Modified | Preserve section structure and confidence in report conversion. |
| `server/src/evaluation/extractionQualityEval.ts` | Modified | Granular baseline and label-based cell matching. |
| `server/src/services/unifiedComparison/__tests__/*` | Modified | Update assertions for variable rows, sections, and derived confidence. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backward compatibility with cached v1 results | Med | Add `schemaVersion` field; route v1 cached objects through a legacy fallback path. |
| Parser mis-maps ambiguous labels (e.g., "Equipo" → EEE vs Maquinaria) | Med | Prefer most specific alias; route ambiguous labels to `extraRows` for manual review. |
| UI treats granular rows as exclusive/unmapped coverages | Med | Update matrix builder to recognize section metadata and skip the exclusive path for canonical rows. |
| Test churn from hardcoded confidence and four-row shape | High | Mechanical update; schedule a dedicated test-fix pass before merge. |
| Evaluation match rate drops below 90% | Med | Regenerate baseline after prompt/parser tuning; gate merge on match rate >= 90%. |

## Rollback Plan

1. Keep the change behind a feature flag (`granularComparisonSchema`) defaulting to `false` in production until verification passes.
2. If issues arise, disable the flag to revert to schema v1 processing without redeploying.
3. If schema v2 objects are already cached, the legacy fallback path will read them as v1 or regenerate the comparison.
4. Keep the old four-row prompt and alias set in a separate code path for one release cycle before removal.

## Dependencies

- None external beyond the existing Gemini API and unified comparison services.

## Success Criteria

- [ ] Granular rows (Bienes Asegurados sub-items, per-coverage deductibles, Prima, Forma de Pago) render under section headers in the UI.
- [ ] Cell confidence is derived from extraction signals and is no longer hardcoded to `0.85`.
- [ ] Extraction quality evaluation match rate remains >= 90% on the updated granular baseline.
- [ ] All existing tests pass after updating assertions for the new schema.
- [ ] Feature flag toggles between v1 and v2 without errors.
