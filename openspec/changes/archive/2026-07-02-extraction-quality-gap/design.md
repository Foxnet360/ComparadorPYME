# Design: Close the extraction-quality gap with direct-LLM comparison table

## Technical Approach

Make the existing Unified Comparison Engine the default path for `/api/analyze`. Remove the production hard override that forces it off, default the feature flag to `true`, and replace the deep canonical-schema prompt with a flat, four-row comparison table prompt (Bienes Asegurados, Deducibles, Prima con IVA, Forma de Pago). The engine will request the table in JSON and tolerate Markdown/CSV/key-value output through a new flat-table parser. If parsing or validation fails after bounded retries, the adapter automatically falls back to the proven per-quote V2 multimodal pipeline and transforms its output into the same `MatrixRow[]` shape. An evaluation harness compares the tool path against a direct-chat baseline on a fixed 3-quote set and runs as part of the Vitest regression suite.

## Architecture Decisions

| Decision | Options | Tradeoffs | Rationale |
|----------|---------|-----------|-----------|
| Default routing | A) Adapter decides unified-first; B) Controller decides | A keeps routing/fallback/logging in one place; B scatters policy | Choose A: `comparisonEngineAdapter` owns routing, fallback reason, and metrics per spec |
| Flat schema vs nested schema | A) New flat JSON schema; B) keep nested schema and post-process | A reduces LLM friction; B preserves more legacy mappings | Choose A: the direct-chat experiment succeeded with rows × insurers, not 14 categories |
| Parser strategy | A) Single parser handles Markdown/CSV/JSON/KV; B) separate parsers per format | A is more code but matches spec; B is simpler but misses formats | Choose A: implement `flatTableParser` with format detection and normalization |
| Fallback caller | A) Adapter calls new `processQuotesBatch`; B) Controller falls back | A keeps adapter as the single router; B duplicates routing logic | Choose A: extract batch logic from controller into `quoteProcessingService` |
| Feature flag env var | Existing `FEATURE_USE_UNIFIED_COMPARISON_ENGINE`; spec says `USE_UNIFIED_ENGINE` | Existing name is inconsistent with proposal/spec | Add `USE_UNIFIED_ENGINE` to `ENV_FLAG_MAP` and keep the old name as alias |
| Evaluation harness location | A) `server/src/evaluation/extractionQualityEval.ts`; B) reuse `evaluationHarness.ts` | A is purpose-built for table cells; B is coverage-centric and would need heavy changes | Choose A: new module plus a thin Vitest wrapper |

## Data Flow

```
Client POST /api/analyze
        │
        ▼
analysisController.uploadAndAnalyze
        │
        ▼
comparisonEngineAdapter.generateComparison(pdfPaths, userId)
        │
        ├──► featureFlags.isEnabled('useUnifiedComparisonEngine')
        │
        ├──► unifiedComparisonEngine.compare(pdfPaths)
        │         │
        │         ├── upload PDFs → Gemini File API
        │         ├── build flat-table prompt
        │         ├── call Gemini (json / text tolerant)
        │         ├── flatTableParser.parse(response)
        │         ├── validate FlatComparisonSchema
        │         └── retry ≤2 times on parse failure
        │
        ├──► toMatrixRows(result) ──────────────────────► MatrixRow[]
        │
        └──► on failure: processQuotesBatch(pdfPaths)
                       │
                       ├── processQuoteMultimodal per PDF
                       ├── normalize to 14 canonical coverages
                       └── batchToMatrixRows(quotes) ────► MatrixRow[]

        │
        ▼
matrixRowsToComparisonReport(matrixRows) ───────────────► ComparisonResult
        │
        ▼
Save to Supabase (engine_type, fallback_reason, metrics)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/config/featureFlags.ts` | Modify | Remove hardcoded `useUnifiedComparisonEngine = false` override; default flag to `true`; add `USE_UNIFIED_ENGINE` env alias. |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modify | Replace canonical-schema prompt with flat-table prompt requesting the four proven rows. |
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modify | Add `FlatComparisonSchema` (rows × insurers). Keep old schema behind a legacy export for rollback. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Create | Parse Markdown, CSV, JSON array, and key-value LLM outputs into `{ rows, columns, cells, extraRows }`. |
| `server/src/services/unifiedComparison/unifiedComparisonEngine.ts` | Modify | Wire new prompt + flat parser; retry with correction prompt; expose structured failure reason. |
| `server/src/services/unifiedComparison/comparisonEngineAdapter.ts` | Modify | Default to unified; log routing source; call `processQuotesBatch` on failure and transform to `MatrixRow[]`. |
| `server/src/services/quoteProcessingService.ts` | Modify | Export `processQuotesBatch(pdfPaths, options)` extracted from the controller's batch/concurrency logic. |
| `server/src/controllers/analysisController.ts` | Modify | Use adapter as the single router; remove inline unified flag check and duplicate fallback block. |
| `server/src/evaluation/extractionQualityEval.ts` | Create | Harness: baseline direct-chat prompt, tool path via adapter, cell-level match metric. |
| `server/src/evaluation/fixtures/extraction-quality/*.json` | Create | Fixed 3-quote set metadata + persisted baseline snapshots. |
| `server/src/evaluation/__tests__/extractionQuality.test.ts` | Create | Vitest regression test asserting ≥90% cell match and <10% fallback rate. |
| `server/src/services/unifiedComparison/__tests__/flatTableParser.test.ts` | Create | Unit tests for parser format detection and normalization. |
| `server/src/services/unifiedComparison/__tests__/fallback.test.ts` | Modify | Update mocks to assert adapter-driven fallback with reason. |

## Interfaces / Contracts

### Flat comparison result (new engine output)

```typescript
export interface FlatComparisonResult {
  metadata: {
    generatedAt: string;
    model: string;
    pdfCount: number;
    processingTimeMs: number;
    confidence: number;
    needsHumanReview: boolean;
    fromCache?: boolean;
  };
  insurers: string[];
  rows: Array<{
    label: string;                 // e.g. "Bienes Asegurados"
    cells: Array<{
      insurer: string;
      value: string | null;
      rawText?: string;
      notFound?: boolean;
    }>;
  }>;
  extraRows: Array<{ label: string; cells: FlatComparisonResult['rows'][number]['cells'] }>;
  warnings: string[];
}
```

### Adapter result envelope

```typescript
export interface ComparisonAdapterResult {
  matrix: MatrixRow[];
  engine: 'unified' | 'fallback';
  fallbackReason?: string;
  correlationId: string;
}
```

### Feature flag contract

- `USE_UNIFIED_ENGINE=true` (default) → unified-first routing.
- `USE_UNIFIED_ENGINE=false` → legacy per-quote V2 only.
- Runtime changes read per request (no caching).

### Evaluation harness contract

```typescript
export interface ExtractionQualityReport {
  baseline: FlatComparisonResult;
  tool: FlatComparisonResult;
  matchRate: number;
  mismatches: Array<{ row: string; insurer: string; baseline: string; tool: string }>;
  fallbackRate: number;
  passed: boolean;
}
```

## Prompt Design

The new prompt asks for exactly one object per insurer column and four rows:

```text
Eres un analista de seguros PYME en Colombia. He subido N cotizaciones del mismo riesgo.
Genera una tabla comparativa con UNA columna por aseguradora y EXACTAMENTE estas filas:
1. Bienes Asegurados
2. Deducibles
3. Prima con IVA
4. Forma de Pago

Reglas:
- Copia los valores textualmente como aparecen en cada cotización.
- No agrupes, no normalices a coberturas canónicas y no inventes datos.
- Si una fila no aparece en una cotización, usa "No informado".
- Responde únicamente con JSON válido que cumpla este schema:
{ "insurers": ["Aseguradora A", ...], "rows": [{"label": "Bienes Asegurados", "cells": [{"insurer": "Aseguradora A", "value": "..."}, ...]}, ...] }
```

A correction prompt retries with the failed response and schema error.

## Parser Strategy

`flatTableParser.parse(raw: string): FlatComparisonResult`

1. **Format detection**
   - Trim and inspect first non-empty lines.
   - Markdown table: lines start/end with `|`.
   - CSV: consistent comma/semicolon delimiters.
   - JSON: starts with `{` or `[`; use `parseJsonWithRepair`.
   - Key-value: fallback regex for `Fila: valor` patterns.

2. **Normalization**
   - Map detected insurer names to columns.
   - Map known row labels (case-insensitive, accent-tolerant) to canonical four rows.
   - Unknown rows go to `extraRows`.
   - Missing rows are created with `notFound: true`.

3. **Validation**
   - Zod schema `FlatComparisonSchema` checks shape.
   - Parser returns a structured error if schema validation fails.

## Fallback Logic

```
unifiedComparisonEngine.compare
  ├── parse/validate success → return FlatComparisonResult
  ├── parse/validate fail → retry ≤2 with correction prompt
  └── still fail → throw UnifiedComparisonError(reason, correlationId)

comparisonEngineAdapter.generateComparison
  ├── flag disabled → route to processQuotesBatch (legacy)
  ├── flag enabled → call unifiedComparisonEngine.compare
  │       └── success → toMatrixRows(result)
  │       └── failure → log { routing: fallback, reason }
  │                     call processQuotesBatch
  │                     transform to MatrixRow[]
  └── return ComparisonAdapterResult
```

`processQuotesBatch` reuses the controller's existing concurrency limit, timeout, and error placeholder logic.

## Feature Flag Wiring

- `DEFAULT_FEATURE_FLAGS.useUnifiedComparisonEngine = true`
- Remove `this.flags.useUnifiedComparisonEngine = false` in `FeatureFlagManager` constructor.
- Add `USE_UNIFIED_ENGINE: 'useUnifiedComparisonEngine'` to `ENV_FLAG_MAP`.
- `unifiedComparisonFlag.isEnabled(userId)` keeps 100% rollout default, so anonymous requests also get unified.

## Evaluation Harness Design

1. **Fixtures**: `server/src/evaluation/fixtures/extraction-quality/quote-set.json` points to three PDF paths and stores a regenerated baseline snapshot.
2. **Baseline runner**: Call Gemini with the direct-chat prompt and the same three PDFs; capture `FlatComparisonResult`.
3. **Tool runner**: POST the same PDFs to `/api/analyze` (or call `comparisonEngineAdapter.generateComparison` directly in tests) and read the resulting comparison table.
4. **Matcher**: Compare cells using normalized text (lowercase, stripped whitespace, accents removed). Report mismatches.
5. **Assertions**:
   - `matchRate >= 0.90`
   - `fallbackRate <= 0.10`

The harness runs with the integration project profile or is skipped when `GEMINI_API_KEY` is missing.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `flatTableParser` for Markdown, CSV, JSON, KV, missing rows | Vitest with fixture strings |
| Unit | Adapter routing and fallback logging | Mock `unifiedComparisonEngine.compare` and `processQuotesBatch` |
| Unit | Feature flag default/override/env mapping | Reset `process.env` and reinstantiate `FeatureFlagManager` |
| Integration | Full unified engine with 3 real quotes | Skipped when `GEMINI_API_KEY` absent |
| Regression | Evaluation harness match rate | Vitest with `describe.skip` guard if fixtures/API missing |
| Build | TypeScript and existing suite | `npm run typecheck:backend && npm test` |

## Migration / Rollout

- No database migration required; `analysis_history` already stores `engine_type`, `fallback_reason`, and `unified_result`.
- Rollback: set `USE_UNIFIED_ENGINE=false` and redeploy, or revert the feature-flag commit.
- First-slice limits to 3–5 quotes per request; monitor fallback rate and token usage.

## Open Questions

- [ ] Should `USE_UNIFIED_ENGINE` become the canonical env name and `FEATURE_USE_UNIFIED_COMPARISON_ENGINE` be deprecated?
- [ ] Is the fixed 3-quote test set available under `tests/fixtures/extraction-quality/` or should we copy it from `Ejemplos/kimi_resultados/`?
- [ ] Does the UI comparison matrix need additional metadata (e.g. `valueSource`) for cells coming from the flat table?
