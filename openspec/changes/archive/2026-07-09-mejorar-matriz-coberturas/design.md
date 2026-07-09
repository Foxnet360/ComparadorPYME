# Design: Mejorar Matriz Coberturas

## Technical Approach

To align PDF extraction and frontend rendering with the PYME business reference template, we implement **Dual-Layer Synchronization** using a **Feature Branch Chain** strategy. 

Instead of rebuilding the matrix on the client, the backend will compute, align, and serve the structured `MatrixRow[]` directly to the frontend. The prompt builder will instruct Gemini 3.5 Flash to output structured quote-level metadata (`quoteMetadata`) and granular business rows. Tab filtering in the frontend is synchronized with backend V2 section IDs to avoid desynchronization.

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| **Backend-driven Matrix Alignment** | Lowers client-side computing and state mapping overhead but introduces tighter backend-frontend API coupling. | **Backend-aligned JSON matrix output**: Ensure a single source of truth for taxonomy, eliminating double-maintenance of row classification rules. |
| **Loose prompt-based JSON Schema** | Doesn't use rigid native `responseSchema` on API level, avoiding token limits/truncation issues on multiple quotes. Requires local parser validation. | **Structured prompt output with local Zod validation**: Prompt contains JSON schema as plain text, parsed and repaired safely in memory. |
| **Metadata integration via prop passing** | Straightforward React prop drilling but increases component interface size. | **Direct ComparisonReport payload expansion**: Update `ComparisonReport` interface to include `matrix: MatrixRow[]` and `quoteMetadata` as top-level fields. |

## Data Flow

```
[N quote PDFs] ──→ (unifiedComparisonEngine.compare)
                       │
                       ├─→ Gemini 3.5 Flash (Single-call structured extraction)
                       │
                       ├─→ (flatTableParser) ──→ Parse quoteMetadata & expanded rows (Zod)
                       │
                       └─→ (matrixTransformer) ──→ Create MatrixRow[] (with sectionId: 100 for financials)
                                                        │
                                                        ▼
                                       (analysisController.uploadAndAnalyze)
                                                        │
                                                        ├─→ API payload: { matrix, quoteMetadata, quotes }
                                                        │
                                                        ▼
                                          [ComparisonReport React Component]
                                                        │
                                                        ├─→ Passes pre-aligned rows & metadata to:
                                                        │
                                                        ▼
                                             [UnifiedCoverageMatrix]
                                             ├── Renders responsive Header Metadata Card
                                             └── Tab-filtering based on synchronized sectionId
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modify | Update `GRANULAR_SECTIONS` and instructions to request expanded business sections and `quoteMetadata`. |
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modify | Extend `SchemaSection` enum and define `QuoteMetadataSchema` + `FlatComparisonSchemaV2` fields. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modify | Extend `RawTable` to support metadata; update `parseJsonV2` and `buildV2Result`; extend `ALIAS_MAP` and add `sectionByKeyword`. |
| `server/src/services/unifiedComparison/matrixTransformer.ts` | Modify | Align `FINANCIAL_SECTION_ID = 100` and map `SchemaSection.FINANCIAL` rows. |
| `server/src/controllers/analysisController.ts` | Modify | Update interfaces, populate and forward `matrix` and `quoteMetadata` fields. |
| `server/src/types.ts` & `types.ts` | Modify | Add `matrix?: MatrixRow[]` and `quoteMetadata?: any[]` to `ComparisonReport` type definitions. |
| `components/ComparisonReport.tsx` | Modify | Pass `rows={report.matrix}` and `quoteMetadata={report.quoteMetadata}` to `<UnifiedCoverageMatrix>`. |
| `components/UnifiedCoverageMatrix.tsx` | Modify | Receive metadata, use pre-aligned matrix rows, fix financials tab filtering, and render Header Metadata Card. |

## Interfaces / Contracts

```typescript
export interface QuoteMetadata {
  insurer: string;
  cliente?: string | null;
  tipoSeguro?: string | null;
  ubicacionRiesgo?: string | null;
  anoConstruccion?: string | null;
  pisos?: string | null;
  aliado?: string | null;
  actividadOcupacion?: string | null;
  documento?: string | null;
  vigencia?: string | null;
}

export interface ComparisonReport {
  id?: string;
  quotes: QuoteAnalysis[];
  recommendation: string;
  marketAnalysis: string;
  deductibleComparison: { insurer: string; deductibleText: string }[];
  matrix?: MatrixRow[];       // Synced backend rows
  quoteMetadata?: QuoteMetadata[]; // Extracted risk details
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend (Unit) | Metadata extraction and label alias parsing | Unit tests in `flatTableParser.test.ts` mapping new business coverages and validating unmapped labels dynamic sectioning. |
| Backend (Integration) | Transformer mapping rules | Integration tests in `matrixTransformer.test.ts` verifying rows have aligned `sectionId` (e.g. 100 for financial rows). |
| Frontend (Unit) | Header Card & Synchronized Filtering | Unit tests in `UnifiedCoverageMatrix.test.tsx` ensuring metadata card displays all 9 fields and the financials tab renders rows with `sectionId: 100`. |

## Risks & Tradeoffs
- **Legacy cache compatibility**: Old extraction responses lack `matrix` and `quoteMetadata` fields. **Mitigation**: Implement robust fallback parsing in the frontend where it falls back to client-side reconstruction if `matrix` is absent.
- **Prompt token overhead**: Prompt increases slightly. **Mitigation**: Gemini 3.5 Flash possesses ample context window (1M+ tokens); impact is negligible.

## Open Questions
- None.
