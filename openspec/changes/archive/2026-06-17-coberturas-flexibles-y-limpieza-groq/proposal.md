## Why

The quote comparison matrix is currently slow and prone to UI clutter and database rate-limiting. This change resolves critical bottlenecks by eliminating dynamic in-loop embedding API calls in the learning engine, parallelizing sequential raw coverage mappings, fixing ontology/taxonomy ID mismatch bugs, and cleaning up the comparison matrix UI with dynamic category rendering and semantic exclusive grouping.

## What Changes

- **Dependency Removal**: Remove dead `"groq"` and `"groq-sdk"` dependencies from `package.json`/`package-lock.json`.
- **Refactoring & Performance Optimization**:
  - Refactor `learningEngine.ts` to replace dynamic in-loop embedding API calls with local string similarity or Supabase PGVector database storage.
  - Parallelize raw-to-canonical coverage mapping loops in `coverageNormalizer.ts`.
  - Fix ontology/taxonomy category ID format discrepancy (string IDs like `"incendio"` vs numeric IDs like `1`) in `semanticMatcher.ts`.
  - Upgrade LLM consensus in `coverageOntology.ts` to use Gemini structured outputs (`responseSchema`).
- **Frontend Cleanup**:
  - Dynamically load category configurations from `taxonomy.json` instead of hardcoding `CATEGORY_CONFIGS` in `UnifiedCoverageMatrix.tsx`.
  - Group exclusive coverages semantically in `UnifiedCoverageMatrix.tsx` to eliminate visual duplicate rows.

## Capabilities

### New Capabilities

- `dynamic-category-rendering`: Loads matrix categories dynamically from domain configurations to support multi-domain layouts.
- `semantic-exclusive-grouping`: Groups exclusive coverage rows semantically to merge minor insurer naming variations.

### Modified Capabilities

- `coverage-mapping-pipeline`: Parallelizes sequential mappings and resolves category ID format mismatches during raw normalization.
- `learning-engine-optimization`: Replaces dynamic in-loop LLM embedding generations with database vector retrieval or local string similarity matching.

## Impact

- **Affected Files**:
  - `package.json` & `package-lock.json`
  - `server/src/services/learningEngine.ts`
  - `server/src/services/coverageNormalizer.ts`
  - `server/src/services/coverageOntology.ts`
  - `server/src/services/semanticMatcher.ts`
  - `components/UnifiedCoverageMatrix.tsx`
- **APIs & Database**: Optimizes Gemini LLM API usage via structured schema; potential database schema or caching changes if storing embeddings.
- **Feature Flags**: None.
- **Rollback Plan**: Revert files to the previous stable Git commit and reinstall dependencies using `npm ci`.
