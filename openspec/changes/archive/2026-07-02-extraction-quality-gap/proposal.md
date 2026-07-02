# Proposal: Close the extraction-quality gap with direct-LLM comparison table

## Intent

The current `/api/analyze` default path processes each quote in isolation, then forces extraction into a rigid 14-canonical-coverage ontology. The user's direct-chat experiment shows that uploading all quotes together and asking for a concise comparison table yields near-perfect results. This change makes that proven pattern the default analysis path while keeping the per-quote pipeline as fallback.

## Scope

### In Scope
- Enable the Unified Comparison Engine by default via feature-flag change.
- Rewrite the unified comparison prompt to explicitly request the user's proven rows (Bienes Asegurados, Deducibles, Prima con IVA, Forma de Pago).
- Simplify response handling to a flat/table-friendly structure with a robust parser.
- Keep the per-quote V2 pipeline as automatic fallback on validation/parse failure.
- Add an evaluation harness that runs the same quote set through the direct-chat prompt and the tool path.

### Out of Scope
- Retraining or replacing the ontology/thesaurus mapper.
- Changing the UI comparison matrix (14-row view remains).
- Multi-format prompt tuning for the legacy per-quote path.

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.
> Research `openspec/specs/` before filling this in.

### New Capabilities
- `extraction-quality-evaluation`: Evaluation harness and metric collection that compares tool output against a direct-LLM baseline on a fixed quote set.

### Modified Capabilities
- `comparison-engine-adapter`: Change default routing so the unified engine runs first; fallback to legacy is automatic and logged.
- `unified-comparison-extraction`: Update prompt and schema/table parser to mirror the direct-chat comparison table request.
- `quote-analysis-v2`: Treat the per-quote multimodal pipeline as fallback when unified extraction fails.

## Approach

Adopt Approach A from exploration: make the existing Unified Comparison Engine the default path. Remove the hardcoded `useUnifiedComparisonEngine = false` override, default the env flag to true, rewrite the unified prompt to ask for the four user-proven row groups across all insurers, and parse the response as a flat table rather than a deeply nested canonical schema. On parser/schema failure, automatically fall back to the current per-quote V2 pipeline.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/config/featureFlags.ts` | Modified | Remove hard override; default `USE_UNIFIED_ENGINE` to true. |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modified | New prompt, flat/table schema, parser. |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modified | Default routing to unified; fallback logging. |
| `server/src/controllers/analysisController.ts` | Modified | Use adapter as default analyze path. |
| `server/src/services/quoteProcessingService.ts` | Modified | Retained as fallback path only. |
| `server/src/evaluation/extractionQualityEval.ts` | New | Harness comparing direct-chat vs tool output. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regressions on formats the per-quote pipeline handled well | Medium | Fallback preserves old path; shadow-test before full rollout. |
| Flat table parser fails on non-tabular LLM output | Medium | Retry with correction prompt; fallback to V2. |
| Model availability/pricing drift between `gemini-3.5-flash` and `gemini-2.5-flash` | Medium | Align env default and remove hardcoded fallback. |
| Larger context window needed for many PDFs | Low | Limit first slice to 3-5 quotes; monitor token usage. |

## Rollback Plan

Set env `USE_UNIFIED_ENGINE=false` and redeploy. The adapter will route to the legacy per-quote V2 pipeline instantly. Revert the commit if parser issues persist.

## Dependencies

- Existing `unifiedComparisonEngine.ts` and adapter.
- Access to the 3-quote test set used in the direct-chat experiment.

## Success Criteria

- [ ] Direct-chat baseline and tool output match >= 90% of cells on the fixed 3-quote set.
- [ ] `/api/analyze` completes in under 60 seconds for 3 quotes using the unified engine.
- [ ] Unified engine is default in production; fallback rate is < 10% in the first week.
- [ ] No regression in the existing Vitest test suite.
