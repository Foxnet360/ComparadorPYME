# Extraction Quality Evaluation Fixtures

This directory holds the fixed 3-quote regression set used by the extraction
quality harness (`server/src/evaluation/extractionQualityEval.ts`).

## Required files

Place three real PYME quote PDFs at these paths:

- `quote1.pdf`
- `quote2.pdf`
- `quote3.pdf`

The harness loads them through `quote-set.json`. The baseline snapshot
(`baseline-snapshot.json`) is a persisted direct-LLM output used for
reproducible comparisons.

## Running the regression

```bash
# Required
export GEMINI_API_KEY="your-key"

# Optional: change the Gemini model
export GEMINI_MODEL="gemini-3.5-flash"

# Run only the evaluation test
npx vitest run server/src/evaluation/__tests__/extractionQuality.test.ts --project unit-backend
```

The test is skipped automatically when `GEMINI_API_KEY` is not available.

## Updating the baseline

To regenerate the baseline snapshot from a fresh direct-LLM run:

```bash
export GEMINI_API_KEY="your-key"
cd server
ts-node --transpile-only -e "
  const { loadFixture, runExtractionQualityEval } = require('./src/evaluation/extractionQualityEval');
  loadFixture('./src/evaluation/fixtures/extraction-quality/quote-set.json')
    .then(fixture => runExtractionQualityEval(fixture, { updateBaseline: true }))
    .then(report => { console.log(JSON.stringify(report, null, 2)); process.exit(report.passed ? 0 : 1); })
    .catch(err => { console.error(err); process.exit(1); });
"
```

## `USE_UNIFIED_ENGINE` toggle and rollback

The unified comparison engine is enabled by default via
`useUnifiedComparisonEngine: true` in `server/src/config/featureFlags.ts`.

- **Enable** (default): `USE_UNIFIED_ENGINE=true` or unset.
- **Disable**: `USE_UNIFIED_ENGINE=false` forces the legacy per-quote pipeline.
- **Rollback procedure**: set `USE_UNIFIED_ENGINE=false` in the environment and
  redeploy. No database migration is required because
  `analysis_history.engine_type`, `fallback_reason`, and `unified_result`
  already store the required metadata.

The evaluation harness asserts that the production tool path matches the
direct-LLM baseline with a cell match rate ≥ 90% and a fallback rate ≤ 10%.
