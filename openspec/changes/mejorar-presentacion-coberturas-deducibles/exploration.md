## Exploration: mejorar-presentacion-coberturas-deducibles

### Current State
Today, when generating a comparison report, the system default is to run in V1 mode (`granularComparisonSchema: false`). This extracts exactly four high-level, flat rows (`Bienes Asegurados`, `Deducibles`, `Prima con IVA`, and `Forma de Pago`) via a single-call LLM prompt. This forces the LLM to output long, concatenated strings in the cells, which the frontend renders directly, making side-by-side comparison difficult.

Even when V2 is enabled, the prompt builder only extracts a subset of coverages and deductibles (leaving standard coverages like Responsabilidad Civil, Lucro Cesante, and others completely missing or unmapped). Furthermore, the deductible matrix display and metrics dashboard are broken due to case mismatches (`"No especificado"` vs `"NO ESPECIFICADO"`) and incomplete data.

### Affected Areas
- `server/src/config/featureFlags.ts` — Enable `granularComparisonSchema` by default.
- `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` — Expand the V2 granular sections/rows to include all 14 canonical coverages and their respective deductibles.
- `server/src/services/unifiedComparison/flatTableParser.ts` — Add new canonical alias mappings and section keywords for the newly added coverages.
- `server/src/services/hybridDeductibleParser.ts` — Add S.M.M.L.V / S.M.M.L.V. dots-tolerant normalization during input parsing.
- `server/src/controllers/analysisController.ts` — Ensure `matrixRowsToComparisonReport` correctly maps all 14 canonical categories to standard taxonomy IDs and canonical names.
- `components/DeductibleMatrix.tsx` — Fix case mismatches in unspecified deductible checks (checking case-insensitively) so the card and ranking scores work correctly.

### Approaches
1. **Frontend-only reconstruction (Not Recommended)**
   - Reconstruct and split the concatenated strings client-side using regex/AI.
   - Pros: No backend prompt/parsing modifications needed.
   - Cons: Highly fragile, prone to alignment errors across insurers, duplicates layout parsing logic.
   - Effort: High

2. **Backend-driven Granular Extraction via V2 Expansion (Recommended)**
   - Enable `granularComparisonSchema` by default, expand the V2 prompt builder to extract all 14 standard coverages and deductibles, normalize SMMLV in the backend parser, and fix the frontend case-mismatches.
   - Pros: Single source of truth, leverages LLM for precise alignment, robust parsing, and provides rich structured data with citations. Fixes the broken dashboard card natively.
   - Cons: Increases prompt token overhead slightly (negligible for Gemini 3.5 Flash).
   - Effort: Medium

### Recommendation
Adopt **Approach 2**. Expanding the V2 granular comparison schema is the cleanest, most scalable way to align both coverage and deductible presentation with the standard taxonomy. It ensures clean, side-by-side columns, leverages our state-of-the-art hybrid parser, and natively repairs the dashboard metrics.

### Risks
- **Gemini Output Variabilities**: Extracting 14+ coverages in a single call increases the likelihood of slight format variations.
  - *Mitigation*: Ensure tight Zod-enforced schemas and prompt rules in `comparisonPromptBuilder.ts` with local parsing recovery (`jsonRepair`).
- **Data Migration & Cache**: Existing cached comparisons lack V2 granular fields.
  - *Mitigation*: Fall back gracefully to V1 layout if the cached comparison does not have `schemaVersion === 2`.

### Ready for Proposal
Yes — the orchestrator is ready to present the structured proposal and design plan to the user.
