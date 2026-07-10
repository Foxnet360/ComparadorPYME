# Design: Mejorar Presentación de Coberturas y Deducibles

## Technical Approach

We will replace the flat V1 4-row extraction with the granular, section-aware V2 comparison schema as the default. To achieve this, we will expand the V2 prompt builder and parser to support a comprehensive 14-coverage standard taxonomy. Additionally, we will introduce robust dots-tolerant `SMMLV` normalization on the backend parser layer and fix the case-sensitivity bug on the frontend deductible metrics card.

This design aligns with the proposal by organizing the work into two distinct PR slices:
1. **PR #1 (Backend Extractors & Parsers)**: Enables the V2 granular feature flag, expands the V2 prompt builder and parser with the 14 standard categories, and implements dots-tolerant SMMLV normalization.
2. **PR #2 (Frontend Grid & Metrics UI)**: Implements case-insensitive checks for unspecified deductibles, and refines the grid layout for coverage and deductible tables.

---

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **V2 Granular Default Activation** | Pros: Provides rich, side-by-side aligned comparison. Cons: Increases token overhead slightly (negligible for Gemini 3.5 Flash). | **Enable V2 by default** in config by setting `granularComparisonSchema` feature flag to `true`. |
| **SMMLV Normalization Location** | Pros: Normalizing at the parser layer guarantees clean downstream data structures. Cons: Adding frontend regex duplicates logic. | **Backend Parser Layer** is the single source of truth for SMMLV parsing and normalization. |
| **Case-Insensitive Deductible Checks** | Pros: Prevents case mismatches from breaking dashboard cards. Cons: Slightly more verbose string comparisons. | **Case-Insensitive Normalization** via `.toUpperCase()` on frontend before evaluation. |

---

## Data Flow

```
+────────────────----+       +───────────────────────────+
| LLM Quote Metadata | ───-─> | V2 Section-Aware Response |
+────────────────----+       +───────────────────────────+
                                           │
                                           ▼ (flatTableParser / hybridDeductibleParser)
                             +───────────────────────────+
                             |   Normalized SMMLV &      |
                             |   Canonical Alias Mapping |
                             +───────────────────────────+
                                           │
                                           ▼ (matrixTransformer / ComparisonReport)
                             +───────────────────────────+
                             |  UI Grids & Metrics Card  |
                             +───────────────────────────+
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/config/featureFlags.ts` | Modify | Set `granularComparisonSchema` to `true` by default in all configuration objects. |
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modify | Expand `GRANULAR_SECTIONS` in `buildV2ComparisonPrompt` to include all 14 canonical categories and prompt the LLM to extract them. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modify | Expand `ALIAS_MAP` to map the 14 standard categories to their correct sections. Support dots-tolerant `S.M.M.L.V.` normalization inside `normalizeDeductibleText`. |
| `server/src/services/hybridDeductibleParser.ts` | Modify | Make `PATTERNS` regex (`smmlv`, `minClause`, `maxClause`) dots-tolerant for SMMLV variation parsing. |
| `components/DeductibleMatrix.tsx` | Modify | Fix case-sensitivity in unspecified deductible card and ranking evaluation by comparing strings case-insensitively. |

---

## Interfaces / Contracts

### Expanded `GRANULAR_SECTIONS` Schema (`comparisonPromptBuilder.ts`)
```typescript
const GRANULAR_SECTIONS = [
  {
    section: 'BIENES ASEGURADOS',
    rows: [
      'Edificio',
      'Contenidos',
      'Mercancías',
      'Muebles y enseres',
      'Maquinaria y equipo',
      'Equipo eléctrico y electrónico',
      'Asistencia',
    ],
  },
  {
    section: 'COBERTURAS',
    rows: [
      'Responsabilidad Civil Extracontractual (RCE)',
      'Lucro Cesante / Pérdidas Consecuenciales',
      'Sustracción con Violencia / Hurto Calificado',
      'Terremoto / Temblor / Erupción Volcánica',
      'AMIT / HMACC (Huelga, Motín, Asonada, Conmoción Civil)',
      'Infidelidad de Empleados',
      'Rotura de Maquinaria',
      'Rotura Accidental de Vidrios',
      'Transporte de Mercancías',
      'Transporte de Valores',
      'Asistencia Legal',
    ],
  },
  {
    section: 'DEDUCIBLES',
    rows: [
      'Todo Riesgo Incendio',
      'Terremoto',
      'AMIT / HMACC',
      'Sustracción con Violencia / Hurto',
      'Responsabilidad Civil (RCE)',
      'Rotura de Maquinaria',
      'Equipo Eléctrico y Electrónico',
      'Transporte de Mercancías',
    ],
  },
  {
    section: 'FINANCIAL',
    rows: [
      'Prima con IVA incluido',
      'Gastos de expedición',
      'IVA',
      'Total prima',
      'Forma de pago',
    ],
  },
] as const;
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | `flatTableParser.ts` alias normalization and `hybridDeductibleParser` SMMLV normalization. | Add unit tests with inputs like `S.M.M.L.V.`, `s.m.m.l.v`, and raw text variations. |
| **Integration** | `comparisonPromptBuilder.ts` prompt structure and adapter V1/V2 routing. | Validate schema-aware JSON structure parsed back via `flatTableParser.parseV2()`. |
| **Frontend Component** | `DeductibleMatrix` summary card and ranking. | Mount components with mixed-case `"no especificado"` values to verify metric cards render correct metrics. |

---

## Migration / Rollout

- **Cache Compatibility**: Legacy V1 reports lack `schemaVersion === 2`. The parser adapter (`comparisonEngineAdapter.ts`) uses `resolveComparisonSchemaVersion()` to fallback to `flatResultToMatrixRows()` (V1 path) if `schemaVersion` is missing or is `1`.
- **Frontend Fallback**: `UnifiedCoverageMatrix.tsx` natively falls back to `transformQuotesToMatrix(quotes)` if backend `rows` are not provided.
- **Rollback Plan**: In case of LLM output anomalies, change `granularComparisonSchema` to `false` in `featureFlags.ts` or set the env variable `GRANULAR_COMPARISON_SCHEMA=false` to immediately fallback to V1 flat table format.

---

## Open Questions

- None.
