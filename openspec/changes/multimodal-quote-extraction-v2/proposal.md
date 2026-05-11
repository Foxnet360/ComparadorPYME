## Why

The current quote extraction pipeline fails in production: `pdfjs-dist` destroys tabular structure, a rigid 14-coverage JSON schema forces Gemini to invent values, insurer detection misidentifies companies (e.g., SBS detected as BBVA), and processing takes 2.4 minutes per analysis due to 66+ synchronous RAG attempts. Logs show extracted premiums, coverage values, and deductibles are frequently incorrect or missing, making the comparison tool unreliable for analysts and clients.

## What Changes

- **Replace text extraction with multimodal PDF ingestion**: Upload PDFs directly to Gemini 2.5 Pro via File API, preserving table structure and spatial relationships
- **Introduce format-family detection**: Detect 6 layout families (TABLE-DOUBLE, TABLE-INTEGRATED, SECTIONS, DESCRIPTIVE, TEXT, PRICE-TABLE) instead of per-insurer profiles
- **Create flexible extraction schema V2**: Remove rigid 14-coverage constraint; extract raw coverages, sub-limits, general deductibles, premium breakdowns, and insured assets as they appear in the document
- **Add specialized prompts per format family**: Each family gets a tailored prompt describing its specific structure (e.g., "deductibles are on page 2" for HDI, "sub-limits marked with (Sublímite)" for CHUBB)
- **Build intelligent post-processing**: Map raw coverages to 14 canonical categories using thesaurus + embeddings, resolve deductibles (specific → general), derive insured amounts from asset tables, and detect implicit coverages
- **Capture per-coverage premiums**: Extract individual premiums when available (e.g., SBS "Todo riesgo daños materiales - Prima $485,151") for true premium comparison
- **Add sub-limit section**: Separate sub-limits from main coverages in output structure
- **Make RAG clause retrieval asynchronous/lazy**: Reduce synchronous RAG calls that add 60-90 seconds to processing time
- **BREAKING**: Change `QuoteExtractionSchema` structure and `ParsedQuote` interface to support flexible extraction instead of forced 14 coverages

## Capabilities

### New Capabilities
- `multimodal-pdf-extraction`: Upload PDFs to Gemini File API and extract structured data with vision, preserving table layouts
- `format-family-detection`: Detect document layout family from extracted text patterns for prompt selection
- `coverage-post-normalization`: Map raw extracted coverages to 14 canonical PYME categories with confidence scoring
- `premium-breakdown-extraction`: Extract detailed premium components (net, fees, taxes, other charges, total payable)

### Modified Capabilities
- `quote-analysis-v2`: Change from text-based extraction to multimodal PDF extraction with flexible schema
- `deterministic-quote-parser`: Deprecate regex-based parsing in favor of AI extraction with deterministic post-processing
- `pdf-text-extraction-v2`: Extend to support format detection before text extraction

## Impact

- **Backend**: `server/src/services/gemini.ts` (File API upload + multimodal generation), `server/src/controllers/analysisController.ts` (new pipeline), `server/src/types.ts` (new interfaces)
- **New services**: `formatDetector.ts`, `coverageNormalizer.ts`, `promptBuilder.ts`
- **Modified services**: `insurerProfileService.ts` → `formatFamilyService.ts`, `quoteParser.ts` (deprecation), `thesaurusMapper.ts` (extended variants)
- **API**: Analysis endpoint response structure changes to include per-coverage premiums, sub-limits, and premium breakdowns
- **Dependencies**: No new dependencies; uses existing `@google/generative-ai` File API features
- **Performance**: Target < 5 minutes total processing (down from 2.4 min per quote), achieved by eliminating 66 synchronous RAG attempts
