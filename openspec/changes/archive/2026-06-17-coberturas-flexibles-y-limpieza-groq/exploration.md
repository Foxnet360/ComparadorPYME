## Exploration: Coberturas Flexibles y Limpieza Groq

### Current State
1. **Groq Dependencies**: The package declarations `"groq"` and `"groq-sdk"` exist in the root `package.json` and are pinned in `package-lock.json`, but they are dead dependencies with zero imports or references in the source code. All AI functionalities are powered by the Google GenAI SDK (`@google/genai`).
2. **Dynamic Domain Constants**: `domainConstants.ts` correctly loads the dynamic categories from `taxonomy.json` for domain configs, but the UI (`UnifiedCoverageMatrix.tsx`) relies on a hardcoded list of categories (`CATEGORY_CONFIGS`), which limits flexibility for different domains.
3. **Sequential Mapping Bottleneck**: In `coverageNormalizer.ts` (`buildOntologyBasedCoverages`), mappings are computed in a sequential loop. If there are cache misses, this triggers database checks, graph checks, and double-agent consensus checks (Taxonomist/Critic LLM calls) sequentially for each raw coverage, causing severe response delays.
4. **Learning Engine API Loop**: In `learningEngine.ts` (`getSimilarCorrections`), the system generates embeddings *dynamically in a loop* for up to 50 user corrections on every single consensus mapping run. This creates an enormous overhead, hitting API rate limits and adding seconds of latency.
5. **Ontology ID Mapping**: `ontology.json` uses string IDs (e.g. `"incendio"`) while `taxonomy.json` uses numeric IDs (e.g., `1`). In `semanticMatcher.ts`, `matchProbabilistic` defaults `categoryId` to `0` because of this format discrepancy, breaking downstream features.
6. **UI Duplicate Rows**: When raw coverages do not match canonical categories, they are classified as exclusive coverages. Because there is no semantic merging of these exclusive coverages in the UI matrix, minor spelling variations across insurers result in duplicated rows.

### Affected Areas
- `package.json` / `package-lock.json` — Remove dead `groq` and `groq-sdk` dependencies.
- `server/src/services/coverageNormalizer.ts` — Parallelize the sequential loop in `buildOntologyBasedCoverages` and optimize implicit coverage detection.
- `server/src/services/coverageOntology.ts` — Integrate Zod schemas for Gemini structured outputs (`responseSchema`) to prevent JSON parsing issues.
- `server/src/services/learningEngine.ts` — Redesign `getSimilarCorrections` to either store embeddings in the database (`pgvector`) or use string/fuzzy comparison logic to bypass in-loop API calls.
- `components/UnifiedCoverageMatrix.tsx` — Refactor the hardcoded `CATEGORY_CONFIGS` to be loaded dynamically from the domain taxonomy configuration, and implement a semantic grouping/merging layer for exclusive coverages to clean up UI layout.

### Approaches
1. **Targeted Remediation (Performance & Architecture Cleanup)** — Remove dead dependencies, refactor `learningEngine` to store embeddings in Supabase or use local fuzzy matching, parallelize mapping logic in `coverageNormalizer.ts`, use Zod structured outputs for LLM consensus, and dynamically load UI category configurations.
   - **Pros**: Drastically reduces API latency, resolves rate-limit vulnerabilities, improves UI layout, and establishes robust JSON consensus parsing.
   - **Cons**: Requires database schema update to support vector embeddings (or a local cache strategy), and frontend adjustments.
   - **Effort**: Medium

2. **Minimal Workaround** — Remove dead dependencies, bypass the embedding-in-loop logic in `learningEngine` using basic string matching, and keep sequential mappings with a simple concurrency limit.
   - **Pros**: Low effort, no database schema modifications.
   - **Cons**: Remains slow on cache misses, doesn't fix rigid hardcoded UI categories.
   - **Effort**: Low

### Recommendation
Option 1 is recommended. The dynamic embedding generation in the loop of `learningEngine.ts` is an urgent bug that causes performance failures and rate-limit blockages during quote analysis. Resolving this alongside parallelizing the ontology mapper is critical.

### Risks
- **Supabase pgvector Availability**: If the database does not support `pgvector` for storing correction embeddings, we must fall back to local string-similarity calculations (e.g., Levenshtein or Sørensen–Dice coefficient) or exact term matches for finding similar corrections.
- **Concurrent LLM Calls**: Parallelizing mapping could trigger concurrent rate limits on the Gemini API. A promise pool or throttle mechanism (e.g. concurrency limit of 5) should be used.

### Ready for Proposal
Yes — Proceed with Option 1. We will outline the design specifications for dependency removal, vector database/caching remediation for corrections, parallel mapper logic, and dynamic frontend category rendering.
