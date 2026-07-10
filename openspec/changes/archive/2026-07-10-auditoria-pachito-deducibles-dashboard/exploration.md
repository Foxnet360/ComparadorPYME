# Exploration: Auditoría Pachito — Deducibles y Dashboard

## Current State

The Pachito el Chef analysis now completes with the unified V2 engine (production deployment c002be4d, 2026-07-10) without timeouts. The backend returns 27 data rows and a 33-row matrix. Despite the successful extraction, the dashboard and deductible sections show several issues:

1. **Dashboard shows $0 annual premium, -0% savings, and identical scores (71/100) for both quotes.**
2. **The "DEDUCIBLES" section in the coverage matrix lists only a subset of the deductibles that are present in the quotes.**
3. **The separate "Deducibles" tab renders a matrix plus a "Texto Completo de Deducibles" collapsible section; the user wants only the matrix.**
4. **The client/technical toggle is shown in the deployed UI, but it is already removed in the current source code.**

## Affected Areas

- `server/src/services/unifiedComparison/matrixTransformer.ts` — V2 financial rows that land in `extraRows` are not mapped to `FINANCIAL_SECTION_ID` because the transformer compares the section name against `FINANCIAL_SECTION_LABEL` (`PRIMAS Y COSTOS`) while the parser emits the enum value `FINANCIAL`.
- `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` — The DEDUCIBLES section lists 13 granular rows, but the business-rule text only asks for 5; the model is also told it may omit, add, or rename rows.
- `server/src/controllers/analysisController.ts` — Financial rows are only used for premium extraction when `row.sectionId === FINANCIAL_SECTION_ID`. If financial rows end up in the coverage section, `priceAnnual` stays 0 and the semantic matcher tries to match financial labels as coverages (visible in Railway logs as "No match found for Prima con IVA incluido / IVA / Total prima / Forma de pago").
- `components/ComparisonReport.tsx` — The "Deducibles" tab renders `DeductibleMatrix` followed by a full-text collapsible block.
- `components/DeductibleMatrix.tsx` — Builds a row for every coverage that has a non-empty `deductible`, including "No especificado" rows; this can clutter the matrix.
- `components/UnifiedCoverageMatrix.tsx` — Business-section grouping places deductible rows for categories such as Incendio (1) and Asistencia (11) under "BIENES ASEGURADOS" and "COBERTURAS" instead of a unified "DEDUCIBLES" section.
- Production deployment — The current source already hardcodes `viewMode = 'technical'` in `ComparisonReport.tsx`, so the client/technical toggle issue is likely a stale deployment.

## Approaches

1. **Fix V2 transformer financial-section mapping** — Apply the same `isFinancialRowLabel` / `FINANCIAL` → `PRIMAS Y COSTOS` mapping used for canonical rows to the `extraRows` before grouping, so financial rows receive `sectionId: 100`.
2. **Strengthen the V2 deductible prompt** — Make the DEDUCIBLES business rule consistent with the granular row list and instruct the model to return all deductible rows that appear in the quotes.
3. **Filter DeductibleMatrix rows** — Only show rows where at least one quote has a specified deductible (i.e., not "No especificado", "No aplica", or empty).
4. **Remove the full-text deductible section** — Delete the "Texto Completo de Deducibles" collapsible block from the "Deducibles" tab in `ComparisonReport.tsx`.
5. **Redeploy after fixes** — Ensure the production deployment reflects the current source code so the client/technical toggle is gone.

## Recommendation

Combine approaches 1–4 in a single SDD change. Start with the backend transformer and prompt fixes so that prices and deductibles are extracted correctly, then adjust the frontend presentation. Approach 5 is a deployment action, not a code change.

## Risks

- Prompt changes can alter the set of rows returned by the LLM; regression testing with the Pachito example is required.
- Mapping `extraRows` to the financial section may affect other V2 reports if the label heuristic is too broad.
- Removing the full-text deductible section removes a fallback for auditors; ensure the matrix is complete first.
- The identical-score issue is a consequence of `priceAnnual === 0`; once prices are extracted, the score differentiation should improve.

## Ready for Proposal

Yes.
