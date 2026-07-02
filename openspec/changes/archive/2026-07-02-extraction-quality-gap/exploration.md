## Exploration: Closing the extraction-quality gap vs direct LLM chat

### Current State

The default analyze path in `analysisController.ts` is the **multimodal V2 per-quote pipeline** (`quoteProcessingService.processQuoteMultimodal`). For each PDF it:

1. Extracts native text and detects a format family.
2. Builds a specialized format-family prompt (`promptBuilder.ts`) or a layout-aware template prompt (`layoutAwarePromptBuilder.ts`).
3. Uploads the single PDF to Gemini File API and calls `geminiService.extractFromPdfWithVision` with `responseSchema: QuoteExtractionSchemaV2` and Zod validation.
4. Normalizes raw coverages into 14 canonical PYME categories via thesaurus / fuzzy / embedding / ontology / double-agent consensus (`coverageNormalizer.ts`, `coverageOntology.ts`, `thesaurusMapper.ts`).
5. Extracts premium breakdown, reconciles against clause data, runs value-source validation and dual-extraction validation, then scores and narrates per quote.

A **legacy text-based path** still exists for scanned PDFs or V2 failures.

A **Unified Comparison Engine** already exists (`server/src/services/unifiedComparison/unifiedComparisonEngine.ts`) that uploads all PDFs and calls Gemini once with a comparison prompt. It is the closest implementation to the user's successful direct-chat experiment, but it is **disabled by default** because `featureFlags.ts` hardcodes `useUnifiedComparisonEngine = false`.

The user's direct-chat success case is essentially: "upload all three quotes and ask for a comparison table with explicit rows (Bienes Asegurados, Deducibles, Prima con IVA, Forma de Pago), letting the model align equivalent coverages across insurers."

### Affected Areas

- `server/src/controllers/analysisController.ts` — orchestrates path selection; unified engine is attempted first but immediately falls back because the feature flag is forced off.
- `server/src/services/quoteProcessingService.ts` — V2/legacy prompts, Zod validation ladder, fallback logic.
- `server/src/services/gemini.ts` — model selection (env default `gemini-3.5-flash`, but code has a fallback to `gemini-2.5-flash`), `temperature: 0.1`, JSON schema enforcement, JSON repair.
- `server/src/services/promptBuilder.ts` / `layoutAwarePromptBuilder.ts` — per-format prompt fragments and grounding rules that add length and constraints.
- `server/src/schemas/extractionSchemas.ts` — Zod schemas that reject or silently coerce responses (v1 uses `passthrough`, but required fields and type checks still cause fallback to raw extraction).
- `server/src/services/coverageNormalizer.ts` / `coverageOntology.ts` / `thesaurusMapper.ts` — rigid canonical mapping and double-agent consensus can misclassify insurer-specific coverage names or mark them EXCLUSIVE / missing.
- `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` and `unifiedComparisonEngine.ts` — already implement single-call comparison but are not the active path.
- `server/src/config/featureFlags.ts` — forces `useUnifiedComparisonEngine = false` regardless of environment.

### Approaches

1. **Approach A: Make the Unified Comparison Engine the default extraction path**
   Use the existing single-call multimodal engine for all PDFs, with a prompt explicitly shaped like the user's direct-chat success (a comparison table with the rows the user listed). Keep the per-quote V2 pipeline as fallback for deep clause validation or when the unified call fails schema validation.
   - Pros: Matches the proven direct-LLM pattern; cross-quote alignment is done by the model in one context; fewer moving parts; lower latency than N per-quote calls; infrastructure already exists.
   - Cons: Requires rewriting the unified prompt and possibly simplifying its schema; fallback behavior must be robust; may need a larger context window for many PDFs; caching/reconciliation need to be adapted.
   - Effort: Medium

2. **Approach B: Add a direct "comparison table" extraction mode to the existing flow**
   Add a new extraction mode/prompt that sends all quotes together and asks the model to emit a comparison table, then parse the table directly into `MatrixRow[]` without forcing the 14-canonical coverage mapping. Gate it behind a feature flag.
   - Pros: Minimal new infrastructure; directly captures the user's prompt; can be rolled out incrementally; preserves current fallback.
   - Cons: Still requires building a parser for the table format; less leverage of the existing unified engine's structured schema; does not solve model-selection/schema issues for the legacy path.
   - Effort: Low-Medium

3. **Approach C: Fix the current per-quote V2 pipeline with prompt/schema/ontology tuning**
   Use the configured stronger model, remove over-restrictive anti-hallucination rules, add few-shot examples of the exact table, lower normalization pressure by keeping raw names, and relax Zod validation.
   - Pros: Keeps the current architecture intact; addresses some root causes directly.
   - Cons: Many small knobs; the fundamental problem (per-quote isolation + rigid canonical ontology) remains; unlikely to match the direct-chat quality.
   - Effort: Medium-High

### Recommendation

Adopt **Approach A as the primary path** and **Approach B as a fast incremental variant**.

The user's direct-chat success is structurally identical to the existing Unified Comparison Engine. The main blockers are that the engine is disabled by default and its prompt/schema do not mirror the exact concise table request. The concrete next steps are:

1. Enable the unified engine for the standard `/api/analyze` flow by removing the hard override in `featureFlags.ts`.
2. Rewrite the unified comparison prompt to ask explicitly for the rows the user listed:
   - Bienes Asegurados (Mercancías, Muebles y enseres, Maquinaria y Equipo, Equipo Eléctrico y Electrónico, Asistencia)
   - Deducibles (TODO RIESGO INCENDIO, ANEGACIÓN / EXTENDED COVERAGE, TERREMOTO, HMACC-AMIT)
   - PRIMA CON IVA INCLUIDO
   - Forma de Pago
3. Simplify the response schema to a flat table-friendly structure, or use free-text table output with a robust parser, so the model spends tokens on accuracy instead of on satisfying a nested schema.
4. Keep the per-quote V2 pipeline as a fallback for deep clause validation and for cases where the unified call fails validation.
5. Add an evaluation harness that runs the same 3 quotes through the direct-chat prompt and through the tool to measure extraction accuracy before and after the change.

### Risks

- Switching the default extraction path can regress quote formats that the per-quote pipeline currently handles via format-family-specific prompts.
- Flat/free-text table output is harder to validate and cache than structured JSON; parser failures could increase.
- Model name/version drift: `env.ts` defaults to `gemini-3.5-flash`, but `gemini.ts` contains a hardcoded fallback to `gemini-2.5-flash`; these must be aligned and verified for availability/pricing.
- The ontology/consensus learning engine may resist new raw coverage names that are not in the canonical set; the unified/table mode should bypass ontology normalization.

### Ready for Proposal

Yes. The gap is well explained by (1) per-quote isolation, (2) rigid canonical schema/ontology, and (3) the unified path being disabled. The next phase should be `sdd-propose` to define the exact change scope, feature-flag rollout, prompt rewrite, schema simplification, fallback strategy, and evaluation criteria.
