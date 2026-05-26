## Why

The system fails to correctly extract coverage data from Allianz quotes and times out processing large quotes (HDI: 17 coverages, SBS: 22 coverages). The root causes are: (1) Allianz uses a "Conditions" document format with descriptive text instead of tables, which the current system does not support; (2) coverage normalization is extremely slow (~7 seconds per coverage) because embeddings are generated one-by-one via API calls; and (3) the fixed 2-minute timeout is insufficient for quotes with many coverages, causing complete analysis failure.

## What Changes

- **New Format Family `CONDITIONS`**: Add support for Allianz-style documents where coverages are described in narrative text with bullet points, not in tables. This includes updating the format detector, prompt builder, and extraction pipeline.
- **Batch Embedding Normalization**: Send multiple coverage names in a single Gemini API call to compute embeddings in batches of 10-20, reducing normalization time from ~7s per coverage to one API call per batch.
- **Persistent Embedding Cache**: Store computed embeddings in a Supabase table so that repeated coverage names never need re-computation across analyses or server restarts.
- **Hybrid Matching Strategy**: Use thesaurus + fuzzy matching for common coverage names without calling the embedding API at all. Only use embeddings for ambiguous cases.
- **Dynamic Timeout**: Replace the fixed 2-minute timeout with a formula based on coverage count (e.g., 30s + 3s per coverage) so large quotes get more time and small quotes fail faster.
- **Graceful Degradation**: If one quote times out, continue processing the remaining quotes instead of failing the entire analysis.

## Capabilities

### New Capabilities
- `quote-extraction-conditions-format`: Support for descriptive/contractual document formats (Allianz) where coverages are in narrative text.
- `batch-embedding-normalization`: Batch processing of coverage embeddings to reduce API calls and latency.
- `embedding-cache-persistent`: Persistent storage of coverage embeddings in Supabase to avoid recomputation.

### Modified Capabilities
- `quote-extraction`: Update the format detector and prompt builder to recognize and handle the new `CONDITIONS` format family.
- `coverage-normalization`: Change the normalization pipeline to use batch embeddings, hybrid matching, and persistent cache lookups.

## Impact

- **Backend Services**: `formatDetector.ts`, `promptBuilder.ts`, `analysisController.ts`, `semanticMatcher.ts`, `coverageNormalizer.ts`
- **Database**: New table `coverage_embeddings_cache` in Supabase
- **External APIs**: Reduced Gemini API calls (from N per quote to ~N/10 per quote)
- **User Experience**: Allianz quotes will be analyzable; HDI and SBS large quotes will complete without timeout
