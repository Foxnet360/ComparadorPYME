## Exploration: Coverage Matrix Grouping & Quote Data Extraction Quality

### Current State
Currently, when a multi-quote comparison is run, the V2 granular extraction pipeline (`unifiedComparisonEngine.ts`) uploads the quote PDFs and instructs Gemini to return a structured table grouped by generic sections. However:
1. **Desynchronized Matrix Transformation**: While the backend processes rows and labels into a aligned set of `MatrixRow[]` via `flatResultToMatrixRowsV2` in `matrixTransformer.ts`, this data is flattened into a legacy `ComparisonReport` layout when transmitted through `matrixRowsToComparisonReport` in `analysisController.ts` for backward-compatible storage and JSON API delivery.
2. **Ignored Frontend Row Grouping**: On the frontend, the UI (`ComparisonReport.tsx`) renders `<UnifiedCoverageMatrix>` by passing `quotes={report.quotes}`, completely discarding the backend-aligned matrix rows. Without pre-built `rows`, `UnifiedCoverageMatrix` defaults to client-side reconstruction using `transformQuotesToMatrix(quotes)`, mapping items to 14 hardcoded categories or classifying them under generic `"AMPAROS EXCLUSIVOS"` (under `sectionId: 99`).
3. **Incomplete Prompt Suggestions**: The suggested rows in `comparisonPromptBuilder.ts` are extremely limited (`Edificio`, `Contenidos`, `Mercancías`, etc.). This causes Gemini to omit most business metrics. Furthermore, V2 flat row schemas lack explicit top-level fields for client and policy metadata, causing vital details like constructed floors, year, address, or validities to be unextracted.

---

### Affected Areas
- `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` — Governs multimodal instructions and granular sections passed to Gemini. Must be expanded to match the business reference template.
- `server/src/services/unifiedComparison/comparisonSchema.ts` — Controls parsing validation and supported sections. Must include additional enum categories and support structured metadata.
- `server/src/services/unifiedComparison/flatTableParser.ts` — Normalizes raw LLM output into structured schemas. Needs expanded aliases and validation rules.
- `server/src/controllers/analysisController.ts` — Converts raw adapter rows into the public comparison report. Needs to forward the aligned backend matrix rather than discarding it, and populate client/policy profiles.
- `components/ComparisonReport.tsx` — Serves as the comparison hub. Must pass the backend-provided matrix rows directly into the visual matrix component.
- `components/UnifiedCoverageMatrix.tsx` — Renders the matrix tabs and panels. Must align tab filtering with backend V2 section IDs (e.g., support `FINANCIAL_SECTION_ID = 999`) and display the newly extracted header metadata in a prominent top panel.
- `types.ts` & `server/src/types.ts` — Dictates shared interfaces. Needs a nested `matrix?: MatrixRow[]` on `ComparisonReport` or `UnifiedComparisonReport`.

---

### Approaches

1. **Approach 1: Dual-Layer Synchronization (Unified Change)** — Address both extraction prompts and rendering logic under a single change.
   - **Pros**: Complete alignment in one testable cycle. Frontend immediately displays newly extracted data points with correct grouping. No partial integration states.
   - **Cons**: Touches both frontend and backend files, requiring a medium-sized PR chain to stay within review budget constraints.
   - **Effort**: Medium (approx. 2-3 chained PRs).

2. **Approach 2: Split Sequence (Multi-Change Plan)** — Implement backend prompt/extraction schema changes in Phase 1, followed by a separate Phase 2 for frontend matrix rendering/data integration.
   - **Pros**: Tightly isolated changes with very small PR sizes.
   - **Cons**: Partial state where the backend extracts new metrics but the frontend fails to render them, or places them in "Amparos Exclusivos" due to legacy mapping.
   - **Effort**: High (coordination of two discrete releases and schema fallbacks).

---

### Recommendation
**Approach 1 (Dual-Layer Synchronization)** is highly recommended. Because the frontend rendering and backend prompts are closely coupled via shared schemas, changing one without the other leads to visual regressions or unmapped "extra" row noise. We can group this work into one cohesive OpenSpec change called `mejorar-matriz-coberturas` and execute it in a clean 2-PR or 3-PR stack:
- **PR 1**: Schema and Prompt updates in the backend, plus parser/controller support to pass the full `matrix` in the API response.
- **PR 2**: Frontend integration of the pre-rendered `matrix` rows, tab/panel ID alignment, and header metadata visualization in `UnifiedCoverageMatrix`.

---

### Risks
- **Tokens/Prompt Context Creep**: Expanding prompt suggestions to extract highly specific metadata and sub-categories might increase API latency or cost slightly, though Gemini 3.5 Flash is highly optimized for this load.
- **Cache Mismatches**: Cached reports with old schema versions will not have the `matrix` field or new metadata, necessitating strict backward-compatible rendering logic on the frontend to gracefully degrade if `matrix` is absent.

---

### Ready for Proposal
**Yes**. The diagnosis clearly locates the root causes of the irregular grouping and extraction gaps. We are ready to propose a structured specification and task list to implement the recommended solution.
