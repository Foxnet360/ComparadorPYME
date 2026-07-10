# Proposal: Auditoría Pachito — Deducibles y Dashboard

## Intent

Fix the presentation and extraction issues identified during the Pachito el Chef audit so that the dashboard shows real prices, savings, and differentiated scores; the deductible sections show all extracted deductibles; and the report view is always technical.

## Scope

**In scope:**
- Fix V2 financial-row mapping in `matrixTransformer.ts` so premium rows are recognized as `sectionId: 100` and used for price extraction.
- Align the V2 DEDUCIBLES business rule in `comparisonPromptBuilder.ts` with the granular row list and reduce the model's freedom to omit rows.
- Filter `DeductibleMatrix.tsx` so it only displays rows with at least one specified deductible.
- Remove the full-text deductible collapsible section from `ComparisonReport.tsx`.
- Update the business-section grouping in `UnifiedCoverageMatrix.tsx` so deductible rows are shown together.
- Add or update unit tests for the affected backend and frontend components.
- Deploy the latest source to production so the client/technical toggle is removed.

**Out of scope:**
- Major UI redesign beyond the four audit points.
- New features such as export formats, new charts, or AI explanations.
- Changes to the Railway environment variables or `.env` file handling.
- SMMLV/UVT value reconciliation (flagged as a data-quality warning, not a UI bug).
- Build chunk size optimization (flagged as a warning, not a functional bug).

## Approach

1. **Backend extraction (root cause)**  
   - In `matrixTransformer.ts`, apply the same `isFinancialRowLabel` / `FINANCIAL` → `PRIMAS Y COSTOS` mapping used for canonical rows to `extraRows` before grouping.  
   - In `comparisonPromptBuilder.ts`, rewrite the DEDUCIBLES business rule to match the 13 granular deductible rows and instruct the model to include every deductible that appears in the quotes.

2. **Frontend presentation**  
   - In `DeductibleMatrix.tsx`, filter rows so that a row is only rendered if at least one quote has a deductible that is not empty, "No especificado", "No aplica", or "N/A".  
   - In `ComparisonReport.tsx`, remove the "Texto Completo de Deducibles" collapsible block from the Deducibles tab.  
   - In `UnifiedCoverageMatrix.tsx`, add all categories that have deductible rows to the DEDUCIBLES business section so they appear together.

3. **Verification**  
   - Run the existing unit tests for `matrixTransformer`, `flatTableParser`, `DeductibleMatrix`, and `ComparisonReport`.  
   - Run a local or staging test with the Pachito el Chef PDFs to confirm prices and deductibles are extracted correctly.  
   - Verify the dashboard shows non-zero premiums and differentiated savings/scores.

4. **Deployment**  
   - Merge the fix PR and trigger a Railway deployment. The client/technical toggle will be removed because the current source already hardcodes `viewMode = 'technical'`.

## Rollback Plan

- The changes are localized to transformer, prompt, and component code. If the V2 extraction degrades, the feature-flag system can disable `granularComparisonSchema` and fall back to the legacy per-quote pipeline.
- If the frontend changes cause layout issues, the old components can be restored from Git.

## Risks

- Prompt changes may change the set or wording of rows returned by the LLM; validate against the Pachito example before merging.
- Reclassifying `extraRows` as financial rows may affect other V2 reports if the label heuristic is too broad; test with at least one other quote pair.
- Removing the full-text deductible section removes a fallback for auditors; the matrix must be complete first.
- The production toggle issue will only be resolved after a new deployment.

## Next Steps

Proceed to `sdd-spec` to define delta requirements and scenarios.
