# SDD Explore: Extraction Pipeline Analysis

## 1. Executive Summary

**Project purpose:** Comparador PYME is a React + Node.js/Express application that compares Colombian SME insurance quotes. It extracts structured coverage, deductible, premium, and clause data from PDFs and generates ranked recommendations using AI (Google Gemini) and semantic search (Supabase/pgvector).

**Current extraction approach:** The pipeline is dual-mode. When `ENABLE_MULTIMODAL_EXTRACTION=true`, a **V2 multimodal** path uploads each PDF to Gemini File API, detects a format family, selects a specialized prompt, extracts a flexible schema with per-coverage premiums and raw text snippets, then normalizes raw coverages to 14 canonical PYME categories via a 4-layer semantic matcher. When disabled or on failure, a **V1 legacy** path extracts text with `pdfjs-dist`, pre-processes it, feeds it to Gemini JSON mode, and normalizes via the same matcher. Extracted quotes are validated, scored, cross-referenced against RAG-indexed clause documents, and saved to Supabase.

**Top strengths:**
1. **Redundant extraction strategies** — multimodal vision with structured JSON schema, regex premium fallback, dual-extraction validation for critical coverages, and legacy text fallback reduce single-point failures.
2. **Sophisticated semantic normalization** — 4-layer matcher (thesaurus → fuzzy → embeddings → LLM) plus an optional ontology/graph pipeline maps insurer-specific wording to 14 canonical categories.
3. **Rich post-processing & validation** — Zod schemas, business-rule validation (premium ranges, deductible formats), confidence scoring, and clause reconciliation.
4. **RAG-backed audit loop** — Clause documents are chunked, embedded, and stored in Supabase; extraction results are cross-referenced against them to detect phantom/missing coverages and deductible discrepancies.
5. **Feedback-driven learning** — User corrections are persisted in `coverage_mappings`, applied to thesaurus/embeddings/ontology/graph, and surfaced through metrics.

**Top improvement opportunities (ranked by impact/feasibility):**

| Rank | Opportunity | Expected Benefit | Effort |
|------|-------------|------------------|--------|
| 1 | Stabilize and de-feature-flag the V2 multimodal pipeline | Higher accuracy, fewer invented values, per-coverage premiums | Medium |
| 2 | Unify the coverage normalization paths (thesaurusMapper vs semanticMatcher vs coverageNormalizer) | Less duplication, consistent confidence thresholds, easier maintenance | Medium |
| 3 | Add deterministic pre-validation and OCR for scanned PDFs | Currently a documented non-goal; even a light OCR path would unlock many real-world PDFs | Large |
| 4 | Replace regex-heavy deductible/value parsing with a single structured parser | Fewer brittle regexes, better compound deductible support | Medium |
| 5 | Instrument end-to-end extraction metrics and traces | Currently logs are ad-hoc; structured telemetry would reveal failure modes | Quick win |
| 6 | Consolidate feature flags and remove dead code paths | The codebase has many flags and deprecated services (formatFamilyService, quoteParser) | Medium |
| 7 | Improve test coverage for integration paths | Most tests are unit-level; multimodal/controller integration is under-tested | Medium |

---

## 2. Extraction Pipeline Map

### End-to-end flow (V2 multimodal, default when enabled)

```
Frontend upload
  │ services/geminiService.ts::analyzeQuotesWithGemini()
  │ → POST /api/analyze  (services/apiConfig.ts)
  │
  ▼
server/src/routes/analysis.ts  (mounted via index)
  │
  ▼
server/src/controllers/analysisController.ts::uploadAndAnalyze()
  │
  ├── 0. Feature-flag gate: useUnifiedComparisonEngine? (currently forced false)
  │
  ├── 1. MULTIMODAL PATH (isMultimodalEnabled())
  │   │   processQuoteMultimodal(file, index, total, { domain })
  │   │   server/src/services/quoteProcessingService.ts
  │   │
  │   ├── 1.1 Native text extraction
  │   │   pdfExtractor.extractTextFromPdf(path)
  │   │   → pdfjs-dist/legacy/build/pdf.js
  │   │   → text, pageTextMap, pageTextItems, metadata, isScanned flag
  │   │
  │   ├── 1.2 Format/template detection
  │   │   detectFormatFamily(nativeTextPreview)  (regex/keyword based)
  │   │   detectFormatWithRegistry(...)  (templateRegistryService, gated by flag)
  │   │
  │   ├── 1.3 Layout parsing (if template/graph flag enabled)
  │   │   extractTables(pageTextItems)
  │   │
  │   ├── 1.4 Prompt selection
  │   │   selectExtractionPrompt(detection, template, layout)
  │   │   → buildTemplatePrompt() or buildPromptForFamily()
  │   │
  │   ├── 1.5 Vision-based structured extraction
  │   │   geminiService.extractFromPdfWithVision(pdfPath, prompt, filename, nativeText)
  │   │   → GoogleGenAI files.upload()  (application/pdf)
  │   │   → waitForFilesActive()
  │   │   → models.generateContent({ responseMimeType: 'application/json',
  │   │                              responseSchema: QuoteExtractionSchemaV2 })
  │   │   → parseJsonWithRepair() + validateQuoteExtractionV2()
  │   │
  │   ├── 1.6 Graph enrichment (optional)
  │   │   enrichRawCoveragesWithGraph(rawCoverages, insurer, domain)
  │   │
  │   ├── 1.7 Coverage normalization
  │   │   buildCanonicalCoverages(rawCoverages, insuredAssets, generalDeductibles, pageTextMap, domain)
  │   │   → resolveDeductibles, deriveInsuredAmounts, mapRawToCanonicalBatch
  │   │   → semanticMatcher.normalizeBatch (thesaurus/fuzzy/cache/embeddings/LLM)
  │   │   → detectImplicitCoverages (regex + graph decomposition)
  │   │
  │   ├── 1.8 Premium extraction/validation
  │   │   extractPremiumBreakdown, extractPerCoveragePremiums, validatePremiumBreakdown
  │   │
  │   └── 1.9 Clause reconciliation (non-blocking)
  │       reconciliationService.reconcileQuote(preParsed, { insurerName, productName, domain })
  │
  ├── 2. LEGACY FALLBACK (when multimodal disabled or fails)
  │   pdfExtractor.processMultiplePdfs(...)  (pdfjs text)
  │   processQuoteLegacy(quote, index, total, { domain })
  │   → insurerProfileService.detectInsurer()
  │   → geminiService.extractStructured(text, prompt, pageCount)  (JSON schema V1)
  │   → normalizeCoverages() via thesaurusMapper
  │   → reconciliationService.reconcileQuote()
  │
  ├── 3. Value-source validation (anti-hallucination)
  │   valueValidationService.validateCoverageValues() vs rawText
  │
  ├── 4. Dual extraction validation for critical coverages
  │   dualExtractionService.validateCriticalCoverages(coverages, rawText)
  │   → second Gemini call for Incendio/RC, flags >20% discrepancy
  │
  ├── 5. Validation + confidence scoring
  │   quoteValidator.validateQuote()
  │   confidenceScorer.calculateConfidence()
  │
  ├── 6. RAG cross-reference (async, batched, 30s timeout)
  │   ragRetrievalService.checkInsurerHasClauses()
  │   crossReferenceEngine.crossReferenceQuotesBatch()
  │   clauseCoverageValidator.validate()
  │
  ├── 7. Scoring
  │   quoteScorer.calculateScore()  (rule-based or variableComparisonEngine)
  │
  ├── 8. Narratives + advanced analysis (parallel, timeouts)
  │   narrativeService.generateNarrative()
  │   deductibleAnalyzer.analyzeQuote()
  │   inverseCoverageChecker.checkMissingCoverages()
  │   contextualRiskAnalyzer.contextualizeExclusions()
  │   warrantyComplianceAnalyzer.analyzeConditions()
  │   virtualLawyerService.generateOpinions()
  │
  └── 9. Persist + respond
      saveAnalysisHistory() → Supabase
      generateComparison() → ComparisonReport
```

### Data format at each stage

| Stage | Format | Key file |
|-------|--------|----------|
| Upload | `File[]` (browser) / `Express.Multer.File[]` | `middleware/upload.ts` |
| PDF bytes | `Uint8Array` / temp file | `pdfExtractor.ts` |
| Native text | `string` + `Record<number, string>` page map | `pdfExtractor.ts` |
| Layout | `PageTextItems[]` with `{x,y,width,height,rotation}` | `layoutParser.ts` |
| LLM input | Specialized prompt + PDF via File API | `promptBuilder.ts`, `gemini.ts` |
| LLM output | JSON conforming to `QuoteExtractionSchemaV2` | `schemas/extractionSchemas.ts` |
| Parsed quote | `ParsedQuote` (canonical coverages, rawText, confidence) | `quoteParser.ts` |
| Validation | `ValidationResult` + `ConfidenceResult` | `quoteValidator.ts`, `confidenceScorer.ts` |
| Cross-reference | `CrossReferenceResult[]` | `crossReferenceEngine.ts` |
| Final report | `ComparisonReport` | `analysisController.ts` |

---

## 3. Key Components Inventory

| File / Module | Role | Critical Observations |
|---------------|------|----------------------|
| `services/geminiService.ts` | Frontend-facing wrapper for `/api/analyze`; builds FormData, forwards files + metadata | Thin; no extraction logic. Supports clause IDs from library. |
| `services/apiConfig.ts` | API base URL | Simple localhost vs relative URL logic. |
| `server/src/controllers/analysisController.ts` | Main orchestrator | 914 lines; mixes routing, orchestration, business logic, and result assembly. Contains unified-engine fallback path. |
| `server/src/services/quoteProcessingService.ts` | Core quote processing: multimodal + legacy | Well-structured but long (719 lines). Defines `STRUCTURED_EXTRACTION_PROMPT` inline. Handles Zod-validation retries. |
| `server/src/services/gemini.ts` | All Gemini interactions | Defines `QuoteExtractionSchemaV2`, `DeductibleSchema`, `QuoteExtractionSchema`. Implements File API upload, vision extraction, structured extraction, OCR, deductible extraction, retries. |
| `server/src/services/pdfExtractor.ts` | PDF text/layout extraction | Uses `pdfjs-dist/legacy/build/pdf.js`. Detects scanned docs, validates PDF header/size, extracts per-page text + positional items. |
| `server/src/services/formatDetector.ts` | Format-family detection | Regex/keyword scoring into 7 families. `detectFormatWithRegistry` consults template registry when flag enabled. |
| `server/src/services/promptBuilder.ts` | Specialized prompts per format family | 7 family templates with examples and critical rules. Also delegates template-aware prompts to `layoutAwarePromptBuilder`. |
| `server/src/services/coverageNormalizer.ts` | Maps raw coverages to canonical categories | Large file (980 lines). Contains 4-layer matching, ontology mode, implicit coverage detection, asset/deductible derivation. |
| `server/src/services/thesaurusMapper.ts` | Loads `tesauro(pyme).md` + extensions, fuzzy matching, deductible normalization | Used by legacy path. Has built-in fallback thesaurus. Also seeds coverage graph. |
| `server/src/services/semanticMatcher.ts` | 4-layer semantic matcher with batch embeddings | Pre-computes category embeddings, uses persistent cache, ontology/graph fallback. Core of normalization. |
| `server/src/services/premiumExtractor.ts` | Premium extraction/validation | Regex fallback for premiums, premium breakdown extraction, consistency validation. |
| `server/src/services/textPreprocessor.ts` | Cleans PDF text before LLM | Fixes encoding artifacts, normalizes Colombian numbers, removes artifacts, extracts relevant sections for complex docs. |
| `server/src/services/dualExtractionService.ts` | Second-pass validation for critical coverages | Re-extracts Incendio/RC with a focused prompt and flags >20% discrepancy. |
| `server/src/services/jsonRepair.ts` | Repairs malformed Gemini JSON | Strategies: unterminated strings, trailing commas, truncated structures, invalid escapes, partial extraction. |
| `server/src/services/quoteValidator.ts` | Business-rule validation | Premium range, coverage completeness, deductible format, numeric parsing, cross-field consistency. |
| `server/src/services/confidenceScorer.ts` | Confidence score 0-100 | Weights: coverage 30%, numeric 25%, validation 25%, schema 20%. Penalizes missing premium. |
| `server/src/services/quoteScorer.ts` | Rule-based quote ranking | 6 dimensions, variable-comparison engine optional. Uses hardcoded market benchmark (8.5M COP). |
| `server/src/services/crossReferenceEngine.ts` | Cross-checks quote vs clause docs | Structured-clause path + legacy RAG path. Generates discrepancy alerts. |
| `server/src/services/clauseCoverageValidator.ts` | Bidirectional coverage validation | Detects phantom coverages and mandatory missing coverages. Falls back to hardcoded expected list. |
| `server/src/services/inverseCoverageChecker.ts` | Clause→quote missing coverage detection | Similar to above; falls back to expected coverages. |
| `server/src/services/documentIndexingService.ts` | Indexes clause PDFs into Supabase | Extracts text, renders pages to images, OCR fallback for empty pages, chunks, embeddings, atomic RPC. |
| `server/src/services/ragRetrievalService.ts` | Vector + full-text retrieval | Hybrid search, query expansion, parent-child retrieval, re-ranking, insurer normalization. |
| `server/src/services/structuredClauseExtractor.ts` | LLM extraction of clause structure | Uses Gemini JSON schema to extract coverages, deductibles, exclusions, conditions, definitions. |
| `server/src/services/learningEngine.ts` | Persists and applies user corrections | Updates thesaurus cache, embeddings, ontology, graph. Requires Redis for some features. |
| `server/src/controllers/analysisValidationController.ts` | Correction endpoint | Validates `CorrectionSchema`, persists via `learningEngine.saveCorrection()`. |
| `services/correctionQueue.ts` | Offline correction queue | localStorage-based queue with retry/sync. |
| `hooks/usePdfDocument.ts` | Frontend PDF viewer hook | pdfjs-dist with abort handling, page retrieval, text search. |
| `hooks/useAdvancedAnalysis.ts` | Fetches deductible/inverse analysis | Cache + exponential backoff retry. Most data now comes bundled with `/analyze`. |
| `hooks/useAuditEnrichment.ts` | Fetches `/audit/enrich` | sessionStorage cache, progress state. |
| `utils/textUtils.ts`, `utils/stringUtils.ts` | Normalization, Levenshtein | Shared frontend/backend via copy or build. |
| `utils/severityCalculator.ts`, `utils/winnerDetection.ts` | UI scoring helpers | Rule-based severity, winner by category/overall. |

---

## 4. Technical Findings

### Extraction methods used
- **PDF parsing:** `pdfjs-dist` for text + positional items; no native OCR except a Gemini image-transcription fallback for empty/scanned pages in `documentIndexingService`.
- **LLM extraction:** Google Gemini (`gemini-2.5-flash`/`gemini-3.5-flash` configurable) with `responseMimeType: application/json` and explicit response schemas.
- **Schema versions:**
  - V1 (`QuoteExtractionSchema`): rigid, forces 14 canonical coverages, single `priceAnnual`.
  - V2 (`QuoteExtractionSchemaV2`): flexible, raw coverages, premium breakdown, sub-limits, general deductibles, raw text snippets.
- **Regex:** Premium patterns, deductible parsing, value parsing, section extraction, encoding fixes, JSON repair.
- **Semantic matching:** Thesaurus + fuzzy + embeddings + LLM + optional ontology/graph.

### Prompt engineering approach
- **Format-family specialization:** 7 prompt families (`TABLE-DOUBLE`, `TABLE-INTEGRATED`, `SECTIONS`, `DESCRIPTIVE`, `PRICE-TABLE`, `CONDITIONS`, `TEXT`) with specific instructions and few-shot examples.
- **Template-aware prompts:** When a template registry entry matches, reconstructed markdown tables and insurer-specific hints are injected.
- **Anti-hallucination rules:** "NO inventes valores", "NO ESPECIFICADO" defaults, raw text snippets for audit.
- **Native text reference:** V2 appends extracted native text to the vision prompt as "high-fidelity character reference".

### Validation and post-processing
- **Zod schemas:** `extractionSchemas.ts` with `passthrough()` in v1 for flexibility.
- **JSON repair:** Automatic repair on parse failure; falls back to raw extraction after retries.
- **Business validation:** Premium range 100K–500M COP, deductible format regex, coverage value checks, cross-field consistency.
- **Confidence scoring:** Composite score with thresholds 90/75/50.
- **Dual extraction:** Second Gemini pass for critical coverages to catch hallucinations.
- **Value-source validation:** `valueValidationService` labels values as `extracted`/`calculated`/`inferred` against raw text.

### Error handling and retries
- Gemini calls retry on 429/503 with exponential backoff (up to 120s).
- Zod validation retries up to 2 times before using raw extraction.
- Per-quote timeout: 5 minutes.
- RAG batch timeout: 30s; clause validation timeout: 8s.
- Controller catches errors and returns 502/429/500 with details.
- Failed quotes get placeholder `ParsedQuote` with `isFailed`, `errorCategory`, `errorCode`.

### Scalability/performance considerations
- Quotes processed in parallel batches of 2 for Gemini calls to limit concurrency.
- Category embeddings pre-computed and cached; persistent embedding cache for coverage names.
- RAG batching reduces N×M queries to M unique coverage queries.
- Document indexing renders pages to images and generates embeddings — heavy but one-time.
- Unified comparison engine is disabled by default and forced false in production.
- Redis optional; learning engine disables itself without `REDIS_URL`.

---

## 5. Risk & Quality Assessment

### Likely failure points
1. **Scanned/image PDFs:** Main extraction has no OCR. README explicitly states non-goal. Only clause indexing has a light OCR fallback.
2. **Complex/mixed-layout PDFs:** Format detection is regex/keyword based; a document that mixes families may be misclassified.
3. **Premium extraction:** Relies heavily on LLM; regex fallback patterns are limited and may miss unconventional labels.
4. **Deductible parsing:** Many regexes across `thesaurusMapper`, `deductibleAnalyzer`, `quoteValidator`, `deductibleParser`, `hybridDeductibleParser` with overlapping but inconsistent logic.
5. **Insurer name normalization:** Extracted insurer names drive RAG lookups; mismatches cause skipped clause validation.
6. **Template/graph pipeline:** Feature-flagged off by default; when enabled adds complexity with layout parsing and graph service.

### Observed brittleness
- **Hardcoded values:** `SMMLV_VALUE` defaults differ between `env.ts` (1,423,500), `deductibleAnalyzer.ts` (1,300,000), and README (1,300,000). `MARKET_PRICE_BENCHMARK` is fixed at 8.5M COP.
- **Regex fragility:** Encoding-fix replacements in `textPreprocessor.ts` are exhaustive but manual; Colombian number normalization regex `/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/g` may miss edge cases.
- **Expected coverage list duplication:** The 14 canonical coverages are repeated in `quoteValidator.ts`, `quoteScorer.ts`, `clauseCoverageValidator.ts`, `inverseCoverageChecker.ts`, and frontend constants.
- **Filename-based insurer detection:** `analysisController.ts` derives insurer name from filename via regex `COTIZACION.*?-\s*`; brittle if naming convention changes.
- **Zod passthrough mode:** `ZOD_SCHEMA_VERSION=v1` makes schemas permissive, hiding schema drift.

### Missing safeguards
- No deterministic contract between LLM-extracted values and raw text positions (only optional `rawTextSnippet`).
- No structured telemetry/metrics; success/failure rates per format family are inferred from logs.
- No rate-limiting or queue depth controls beyond Gemini retry and 2-concurrency batch.
- No checksum/deduplication of uploaded PDFs.
- No automatic A/B evaluation between V1 and V2 extractions.

---

## 6. Improvement Recommendations

### Quick wins
1. **Add structured extraction metrics** — count success/repair/fallback per quote, per format family, per model; emit to logs or a metrics table. This reveals the biggest failure modes.
2. **Align SMMLV/UVT defaults** — centralize rates in `env.ts` and import everywhere; remove hardcoded constants.
3. **Centralize canonical coverage list** — single source of truth (e.g., `data/domains/pyme/taxonomy.json`) consumed by validator, scorer, and matchers.
4. **Increase Zod strictness gradually** — move toward `ZOD_SCHEMA_VERSION=v2` once V2 is stable.

### Medium effort
5. **Stabilize V2 multimodal as the default** — remove the `ENABLE_MULTIMODAL_EXTRACTION` opt-out, harden prompt templates, and make the legacy path a true degraded fallback. Add per-format-family evaluation harness.
6. **Unify deductible parsing** — replace scattered regexes with the structured `DeductibleStructure` from `hybridDeductibleParser` across all consumers (validator, analyzer, cross-reference engine).
7. **Unify coverage normalization** — consolidate `thesaurusMapper`, `semanticMatcher`, and `coverageNormalizer` into one matcher with pluggable layers and clear thresholds.
8. **Improve insurer name robustness** — extract insurer name from PDF content (native text) in addition to filename, and maintain an alias mapping table.
9. **Add deterministic grounding** — require each extracted coverage/value to include `rawTextSnippet` and `pageNumber`, and validate that the snippet exists in the native text/page map.

### Large effort
10. **Add first-class OCR support** — integrate a vision OCR path for scanned PDFs in the quote extraction pipeline, not just clause indexing. This is the biggest real-world gap.
11. **Refactor `analysisController.ts`** — split orchestration, result assembly, and persistence into separate services; the controller is currently too large.
12. **Build an evaluation framework** — golden-set evaluation for V1 vs V2, per format family, with human-labeled ground truth. Existing `evaluationHarness.ts` appears to be a start but should be wired into CI.
13. **Simplify feature-flag surface** — retire flags that are always true (e.g., `structuredClauseExtraction`, `semanticCoverageOntology`) and consolidate the template/graph pipeline flags once stable.

---

## 7. Open Questions / Unknowns

1. **Which pipeline is actually used in production?** `featureFlags.ts` forces `useUnifiedComparisonEngine=false`, and `ENABLE_MULTIMODAL_EXTRACTION` is environment-dependent. The effective default extraction mode should be confirmed with the team.
2. **What is the real accuracy of V2 vs V1?** README claims large improvements, but no evaluation harness output was found in the repo. Are these numbers measured or aspirational?
3. **Is the template/graph pipeline used?** It is disabled by default; are there insurers for which templates are registered and producing better results?
4. **How are user corrections surfaced to the matcher?** `learningEngine` updates cache and graph, but it is unclear whether the semantic matcher reads from `coverage_mappings` at inference time or only at retrain time.
5. **What is the status of OCR?** The README says OCR is a non-goal, but `documentIndexingService` has a Gemini OCR fallback. Is quote-level OCR on the roadmap?
6. **How is the `tesauro(pyme).md` maintained?** It is parsed at runtime; is there an editor workflow or version control for additions?
7. **Are there active known bugs?** Recent commits mention "mejora-extraccion-coberturas" slices and remediation; the current branch state should be checked for open regressions.
8. **What is the `unifiedComparisonEngine` intended to replace?** The adapter exists but is disabled; understanding its scope would clarify whether the legacy pipeline should be retired or kept.

---

*Report generated during SDD Explore phase for project `comparadorpyme`.*
