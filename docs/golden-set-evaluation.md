# Golden Set Evaluation

The golden set is a collection of annotated quotes used to measure extraction
accuracy before enabling feature flags in production. The evaluation harness
compares the pipeline output against human-verified expected coverages and
deductibles and produces a structured report.

## Running the evaluation

```bash
npm run evaluate:golden
```

The script loads fixtures from `tests/fixtures/golden-set/` by default. It
uses an echo runner that returns the annotated expected coverages as actual
output, which validates the harness and fixtures without calling external
LLMs.

To run a real evaluation against the full multimodal pipeline, plug a runner
that calls `processQuoteMultimodal` into `server/src/scripts/runEvaluation.ts`.

## Adding a fixture

A fixture is a JSON file with the following shape:

```json
{
  "id": "bbva-001",
  "insurer": "BBVA",
  "description": "BBVA PYME quote with full coverage table",
  "expected": {
    "coverages": [
      { "name": "Incendio (Edificio y Contenidos)", "value": "500000000", "deductible": "10%" }
    ],
    "deductibles": [
      { "text": "10% mínimo 1 SMMLV", "appliesTo": "Incendio (Edificio y Contenidos)" }
    ]
  }
}
```

Place the file in `tests/fixtures/golden-set/{insurer}/` and re-run the
evaluation.

## Metrics

The harness computes the following per-fixture metrics:

| Metric | Definition |
|--------|------------|
| `coverageAccuracy` | Fraction of expected coverages matched by name and value. |
| `deductibleAccuracy` | Fraction of expected deductibles matched by text and applicable coverage. |
| `uncategorizedRate` | Fraction of extracted coverages that could not be normalized. |
| `falsePositiveRate` | Fraction of extracted coverages not present in the expected set. |

Aggregate metrics are weighted by expected coverage count so that large quotes
do not skew the unweighted fixture average.

## Thresholds

Default rollout thresholds are configured in the evaluation harness:

| Metric | Threshold |
|--------|-----------|
| Coverage accuracy | ≥ 85% |
| Deductible accuracy | ≥ 80% |
| Uncategorized rate | ≤ 10% |

A fixture that fails any threshold is flagged for manual review. The report
also detects regressions by comparing the current run against a previous
baseline when one is provided.

## Interpreting the report

The CLI prints a summary table and exits with code `0` when no regressions are
detected. The full report includes:

- Per-fixture accuracy scores.
- Coverage-level diffs (matched, missing, extra).
- A list of fixtures requiring manual review.
- An overall `passed` boolean based on the thresholds.

Use the report to decide whether to enable `useTemplateGraphPipeline` and
insurer-specific template flags in `server/src/config/featureFlags.ts`.
