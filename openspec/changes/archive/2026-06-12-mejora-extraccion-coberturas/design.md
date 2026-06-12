# Design: Improve Coverage, Deductible, and Condition Extraction

## Technical Approach

Add an insurer-aware, layout-aware extraction layer in front of the existing multimodal vision pipeline. The new pipeline is composed of three cooperating layers:

1. **Template Registry**: detects known insurer PDF templates (BBVA, SBS, MAPFRE initially) by text and layout fingerprints and enforces per-template JSON schemas.
2. **Layout Parser**: reconstructs tables/columns from `pdfjs` bounding boxes before LLM extraction, falling back to vision when layout parsing fails.
3. **Coverage Semantic Graph**: a probabilistic graph that backs coverage normalization, composite coverage decomposition, and deductible linking. It seeds from the existing `taxonomy.json`/`ontology.json` and learns from analyst corrections.

Known templates take the structured path; everything else keeps the current vision path and is post-processed by the graph. A golden-set evaluation harness measures accuracy before/after.

## Architecture Decisions

| Decision | Options | Rationale |
|----------|---------|-----------|
| Template storage | Supabase JSONB (`template_registry`) + in-memory cache | Team already uses Supabase/Postgres; JSONB accommodates evolving schemas without DDL migrations. |
| Layout engine | `pdfjs-dist` text items + custom clustering | Already in `package.json` and used by `pdfExtractor.ts`; avoids new OCR dependencies. |
| Graph storage | Extend existing `coverage_mappings` table + Redis cache | The table already stores raw→canonical mappings and corrections; graph edges are modeled as rows/columns, avoiding a separate graph DB. |
| Composite decomposition | Static seed rules + learned rules | Static rules from `ontology.json` guarantee cold-start behavior; learned rules are stored in the graph after analyst confirmation. |
| Rollout | Feature flag `USE_TEMPLATE_GRAPH_PIPELINE` with per-insurer toggles | Allows safe A/B testing and instant fallback to the legacy multimodal path. |

## Data Flow

```
PDF Upload
   │
   ▼
pdfExtractor.extractTextFromPdf() ──► formatDetector.detectFormatFamily()
   │                                          │
   ▼                                          ▼
layoutParser.extractTables()          insurerProfileService.detectInsurer()
   │                                          │
   └──────────────┬───────────────────────────┘
                  ▼
        templateRegistry.matchTemplate()
                  │
      ┌───────────┴───────────┐
      │                       │
 known template            unknown template
      │                       │
      ▼                       ▼
promptBuilder.buildTemplatePrompt()   promptBuilder.buildPromptForFamily()
      │                               │
      ▼                               ▼
geminiService.extractFromPdfWithVision()
      │
      ▼
coverageGraph.enrichRawCoverages() ──► coverageNormalizer.buildCanonicalCoverages()
      │
      ▼
learningEngine.recordCorrection() / coverageGraph.learn()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `server/src/services/templateRegistry.ts` | Create | Registry load/store, fingerprint matching, schema validation. |
| `server/src/services/layoutParser.ts` | Create | `pdfjs` text-item clustering into rows/columns/tables. |
| `server/src/services/coverageGraph.ts` | Create | Graph model, propagation, query API, learning updates. |
| `server/src/services/formatDetector.ts` | Modify | Add `templateId` / `templateConfidence` to `FormatDetectionResult`; call registry. |
| `server/src/services/insurerProfileService.ts` | Modify | Convert profiles into `TemplateRegistryEntry` seeds; keep legacy detection as fallback. |
| `server/src/services/promptBuilder.ts` | Modify | Add `buildTemplatePrompt(templateId, tables)`. |
| `server/src/services/quoteProcessingService.ts` | Modify | Route known templates through structured extraction; attach graph metadata. |
| `server/src/services/coverageNormalizer.ts` | Modify | Consume graph probabilities and decomposed coverages; emit `graphConfidence`. |
| `server/src/services/coverageOntology.ts` | Modify | Use graph for consensus scoring; persist mappings to graph. |
| `server/src/services/semanticMatcher.ts` | Modify | Rank using graph probabilities when available. |
| `server/src/services/thesaurusMapper.ts` | Modify | Update graph on correction in addition to thesaurus. |
| `server/src/services/hybridDeductibleParser.ts` | Modify | Accept template column hints and graph `appliesTo` rules. |
| `server/src/services/learningEngine.ts` | Modify | Write corrections as graph edges/aliases and invalidate caches. |
| `server/src/config/featureFlags.ts` | Modify | Add `useTemplateGraphPipeline` and per-insurer toggles. |
| `server/src/services/goldenSetEvaluation.ts` | Create | Evaluation harness, metrics, regression reports. |
| `server/supabase/migrations/019_template_registry_and_graph.sql` | Create | `template_registry` table and `coverage_graph_edges` table/columns. |
| `data/domains/pyme/template-seeds.json` | Create | Initial template fingerprints and schemas for BBVA/SBS/MAPFRE. |

## Interfaces / Contracts

### `TemplateRegistryEntry`

```typescript
interface TemplateRegistryEntry {
  templateId: string;
  insurer: string;
  displayName: string;
  version: number;
  fingerprints: {
    textMarkers: string[];
    layoutMarkers: Array<{ page?: number; region: string; textRegex: string }>;
    minConfidence: number;
  };
  schema: JSONSchema;
  extractionHints: {
    coverageTablePage?: number;
    deductibleColumnIndex?: number;
    premiumColumnIndex?: number;
  };
  promptAddon: string;
}
```

### `LayoutParserResult`

```typescript
interface LayoutTable {
  page: number;
  bounds: { x: number; y: number; width: number; height: number };
  headers: LayoutCell[];
  rows: LayoutCell[][];
  mergedCells?: LayoutCell[];
}
interface LayoutCell {
  text: string;
  x: number; y: number; width: number; height: number;
  colSpan?: number;
}
```

### `CoverageGraph` API

```typescript
interface CoverageGraph {
  query(rawName: string, insurer?: string): Promise<GraphQueryResult>;
  addEdge(edge: GraphEdge): Promise<void>;
  propagate(): Promise<void>;
  learnCorrection(raw: string, canonical: string, insurer?: string): Promise<void>;
}
interface GraphQueryResult {
  mappings: Array<{ canonicalId: string; confidence: number; provenance: string }>;
  composite: boolean;
  components?: string[];
  deductibleLinks?: Array<{ deductibleText: string; appliesTo: string; confidence: number }>;
}
```

### `GoldenSetEvaluation`

```typescript
interface GoldenQuote {
  filePath: string;
  insurer: string;
  expected: ExpectedCoverage[];
  annotatedBy: string;
}
interface EvaluationReport {
  coverageAccuracy: number;
  deductibleAccuracy: number;
  noMatchRate: number;
  perInsurer: Record<string, { coverageAccuracy: number; deductibleAccuracy: number }>;
  regressions: RegressionItem[];
}
```

## Algorithms

### Template Detection

1. Score text markers: each matched marker adds `weight / count` to a running score.
2. Score layout markers: verify expected text in expected page region using bounding-box intersection.
3. Normalize score to `0-100`. If `>= entry.fingerprints.minConfidence` (default 90), return `templateId`; otherwise return `null`.
4. Insurer template takes precedence over generic `FormatFamily`, but `family` is still returned for compatibility.

### Layout Reconstruction

1. Extract `TextItem` arrays per page from `pdfjs` (`getTextContent`).
2. Cluster items into rows by `y` coordinate using a tolerance band proportional to median line height.
3. Cluster rows into columns by `x` coordinate using DBSCAN or k-means on left edges.
4. Detect headers by comparing first row text against common header tokens (`Cobertura`, `Suma Asegurada`, `Deducible`, `Prima`).
5. Emit `LayoutTable` with merged-cell annotations when adjacent cells share identical text and vertical alignment.
6. If clustering fails (e.g., rotated text, < 2 columns), return `null` and trigger vision fallback.

### Graph Propagation

Graph nodes: `raw_term`, `insurer_alias`, `canonical_category`, `deductible_rule`, `composite_rule`.
Edges: `alias`, `maps_to`, `decomposes_to`, `applies_to`, `learned`, each with `weight` and `correctionCount`.

1. **Seed**: on startup, insert `taxonomy.json` aliases and `ontology.json` composite rules as edges with high weight (`0.95`).
2. **Query**: for a raw term, perform a weighted breadth-first search to canonical nodes up to depth 3, aggregating path weights by multiplying edge weights. Return top-k ranked results.
3. **Deductible linking**: search `applies_to` edges from deductible text / coverage context.
4. **Propagation**: periodically run PageRank-style iteration on learned edges to boost stable corrections and dampen one-off errors.

### Learning Update

1. Analyst correction arrives with `rawName`, `canonicalId`, `insurer`.
2. Upsert a `learned` edge; increment `correctionCount`; recalculate weight using `min(0.99, 0.7 + 0.02 * correctionCount)`.
3. Add raw name as a thesaurus synonym for the canonical category.
4. If this is the first correction for a composite-looking raw name, create a candidate `composite_rule` flagged for review.
5. Invalidate Redis cache keys for this raw name and insurer.
6. Schedule a nightly re-embedding job for corrected mappings.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Template fingerprint scoring, layout clustering, graph propagation, schema validation | Vitest with fixture JSON and mocked `pdfjs` items. |
| Integration | End-to-end quote processing for each seeded template; graph learning from a correction | Run `processQuoteMultimodal` against fixture PDFs; assert expected coverages. |
| Golden Set | Coverage accuracy ≥ 85%, deductible accuracy ≥ 80%, no-match rate < 10% | `goldenSetEvaluation.ts` compares pipeline output to annotated truth; fail CI on regression. |
| Performance | Latency increase ≤ 20%, cache hit rates | Benchmark with `npm run test` and manual timing on 30-quote set. |

## Migration / Rollout

1. **Feature flags**:
   - `USE_TEMPLATE_GRAPH_PIPELINE` — master toggle.
   - `TEMPLATE_BBVA_V1`, `TEMPLATE_SBS_V1`, `TEMPLATE_MAPFRE_V1` — per-template gates.
   - `GRAPH_LEARNING_ENABLED` — controls learning loop writes.
2. **Database migration** `019_template_registry_and_graph.sql`:
   - Create `template_registry` table with JSONB schema/hints.
   - Create `coverage_graph_edges` table (`from_node`, `to_node`, `edge_type`, `weight`, `insurer`, `correction_count`).
   - Add composite/decomposition columns to `coverage_mappings` if absent.
3. **Backward compatibility**: when flags are off, the legacy multimodal + flat normalizer path runs unchanged. The graph is read-only until `GRAPH_LEARNING_ENABLED` is on.
4. **Fallback paths**:
   - Template fingerprint below threshold → generic format family + vision.
   - Layout parse failure → vision-only extraction.
   - Schema validation failure → log structured error, fallback to vision.
   - Graph cold-start miss → existing thesaurus/fuzzy/embedding/LLM layers.
5. **Golden set first**: build and annotate 30 quotes before enabling flags in production; use results to set per-insurer thresholds.

## Open Questions

- [ ] Do we have at least 10 representative PDFs per seeded insurer to validate fingerprints?
- [ ] Should the graph propagate across insurers (e.g., BBVA alias helps SBS) or stay insurer-isolated by default?
- [ ] Where are analyst corrections currently captured in the frontend — do we need a new API endpoint or can we reuse the existing correction controller?
- [ ] What is the target latency budget in milliseconds for a single quote today, so the 20% ceiling can be quantified?
