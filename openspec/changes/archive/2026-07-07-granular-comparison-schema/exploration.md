## Exploration: Granular comparison schema for unified insurance-quote comparison

### Current State

The unified comparison engine (`UnifiedComparisonEngine.compare`) sends all quote PDFs to Gemini in a single call and asks for **exactly four rows**:

1. Bienes Asegurados
2. Deducibles
3. Prima con IVA
4. Forma de Pago

The prompt (`comparisonPromptBuilder.ts`) tells the model to copy values textually and not group/normalize them. The parser (`flatTableParser.ts`) normalizes Markdown/CSV/JSON/key-value output into `FlatComparisonResult`, which is hard-validated to have `rows.length === 4`. Anything that does not match the four canonical labels lands in `extraRows`.

`matrixTransformer.ts` turns the flat result into `MatrixRow[]`. Each of the four rows becomes a single data row under the generic header `INFORMACIÓN GENERAL`, and `Prima con IVA` / `Forma de Pago` are duplicated again under `PRIMAS Y COSTOS`. The controller then converts those `MatrixRow[]` into a legacy `ComparisonReport` where every row label becomes a coverage name.

Confidence is currently **hardcoded**: the engine passes `confidence: 0` to the parser, and `matrixTransformer.ts` writes `confidence: cell.notFound ? 0 : 0.85` on every cell. The extraction-quality harness also hardcodes `0.85`. That is why every audit shows 85 points and every sub-item is dumped into one text block per cell.

### Affected Areas

- `server/src/services/unifiedComparison/comparisonSchema.ts` — remove the `rows.length(4)` constraint and add section/confidence metadata.
- `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` — replace the four-row prompt with a granular template and instructions for missing/differently-named items.
- `server/src/services/unifiedComparison/flatTableParser.ts` — expand row-label aliases to cover granular sub-items, allow variable row counts, and emit section metadata.
- `server/src/services/unifiedComparison/matrixTransformer.ts` — group rows into sections with headers instead of flattening everything under `INFORMACIÓN GENERAL`.
- `components/UnifiedCoverageMatrix.tsx` / `VirtualizedCoverageMatrix.tsx` — render section headers and granular rows; avoid treating all flat rows as unmapped/exclusive coverages.
- `server/src/controllers/analysisController.ts` — `matrixRowsToComparisonReport` must preserve section structure and confidence when building the report.
- `server/src/evaluation/extractionQualityEval.ts` — `CANONICAL_ROW_LABELS` and `matrixRowsToFlatResult` assume only the old four rows; needs a matching granular baseline.
- `server/src/services/unifiedComparison/__tests__/*` — tests assert four rows, hardcoded confidence, and old matrix shape.

### Approaches

1. **Hardcoded granular rows** — keep a strict schema but expand the canonical list from 4 to ~12 fixed sub-rows (Edificio, Contenidos, Mercancías, Maquinaria, EEE, Equipo Móvil, Asistencia, TR/Incendio deductible, Anegación deductible, Terremoto deductible, HMACC-AMIT deductible, Prima con IVA, Forma de Pago). The model is told to output exactly these rows and use "No informado" when absent.
   - Pros: Simple to parse and validate; easy cell-level diff in tests; clear side-by-side comparison.
   - Cons: Brittle — quotes use different wording (e.g., "Inmuebles" vs "Edificio") and may omit or rename sub-items; forces the LLM to invent "No informado" cells, which hurts confidence accuracy.
   - Effort: Medium

2. **Fully open table** — ask the model for a "comfortable comparison table" with sections and any rows it considers relevant, then normalize discovered rows purely by string similarity/clustering with no canonical list.
   - Pros: Maximally flexible; mirrors the free-form table a user gets in direct chat.
   - Cons: Columns can drift between insurers; row alignment becomes unreliable; UI cannot guarantee a stable side-by-side layout; confidence is hard to compute meaningfully.
   - Effort: High

3. **Templated hybrid with alias normalization (recommended)** — provide the model with a preferred template of sections and sub-rows, but explicitly allow it to include, omit, or rename rows. After parsing, map discovered labels to canonical sub-items via an expanded alias dictionary; unmatched rows become `extraRows`. Each row carries a `section` field so the transformer can render proper headers.
   - Pros: Balances clarity and flexibility; can map "Inmuebles" → "Edificio", "Daño Interno" → "Equipo Eléctrico y Electrónico", etc.; missing items are real missing items, not forced "No informado"; backward-compatible if we version the result schema.
   - Cons: Requires maintaining an alias map and updating tests/evaluation harness; UI must learn to render arbitrary sections.
   - Effort: Medium-High

### Recommendation

Adopt **Approach 3 (templated hybrid)**.

Concrete design:

- **Schema**: `FlatComparisonResult.rows` becomes an open list (drop `.length(4)`). Each row gets an optional `section` string (`Bienes Asegurados`, `Deducibles`, `Prima y Costos`, `Forma de Pago`, `Otros`). Cells keep `insurer`, `value`, `rawText`, `notFound` and gain an optional `confidence` number.
- **Prompt**: replace the four-row list with a section template. Example:

```
Secciones sugeridas (incluye las filas que aparezcan en las cotizaciones; usa "No informado" solo si una aseguradora no informa el concepto):

1. BIENES ASEGURADOS
   - Edificio / Inmuebles
   - Contenidos
   - Mercancías / Inventarios
   - Maquinaria y Equipo
   - Equipo Eléctrico y Electrónico
   - Equipo Móvil / Portátil
   - Asistencia

2. DEDUCIBLES
   - Todo Riesgo / Incendio
   - Anegación / Extended Coverage
   - Terremoto
   - HMACC / AMIT

3. PRIMA CON IVA INCLUIDO
4. FORMA DE PAGO
```

- **Parser**: extend `ROW_LABEL_ALIASES` to map common variants (case/accent-insensitive) to canonical row labels and assign a section. Unmatched rows stay in `extraRows` with section `Otros`.
- **Confidence**: compute per-cell from extraction signals instead of hardcoding:
  - `notFound` or empty → 0.0
  - raw text present and equals parsed value → +0.05
  - label matched via exact alias → +0.05
  - value matches expected format (currency for premium, percentage/deductible pattern for deductibles) → +0.05
  - cap at 0.98; baseline non-found average drives `metadata.confidence`.
- **Transformer / UI**: render each section as a header row followed by its granular data rows. Keep `PRIMAS Y COSTOS` for the premium and payment rows. Do not dump granular rows into the unmapped/exclusive section.

### Risks

- **Backward compatibility**: cached `FlatComparisonResult` objects and evaluation baselines use the old four-row shape. A schema version field (`schemaVersion: 2`) or a migration step is needed.
- **UI rendering**: `UnifiedCoverageMatrix` rebuilds the matrix from `QuoteAnalysis[]` and treats unmapped coverages as exclusive. Granular flat rows must either map to taxonomy categories or bypass that component with a new section-aware renderer.
- **Prompt length / context window**: the granular template adds tokens, but Gemini 3.5 Flash handles it well; still, keep the prompt concise and avoid long prose.
- **Parser complexity**: more aliases and section logic increase the chance of mis-mapping (e.g., "Equipo" alone could map to EEE or Maquinaria). Use the most specific alias and allow `extraRows` for ambiguous cases.
- **Test churn**: many tests assert the four-row shape and `0.85` confidence; updating them is mechanical but broad.
- **Evaluation harness**: cell-level match rate currently compares only four rows. A granular baseline snapshot must be generated and the matcher updated to align by canonical row label.

### Ready for Proposal

**Yes.** The next step is `sdd-propose` to define the scope, feature-flag strategy, rollback plan, and the exact canonical row/alias dictionary.
