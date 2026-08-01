# Golden Set Evaluation Baseline Report

## Baseline Overview
This report establishes the initial performance baseline for the **ComparadorPYME / CSA** extraction pipeline.

- **Date**: 2026-08-01
- **Runner**: Multimodal Pipeline (`runEvaluation.ts`)
- **Total Fixtures**: 30
- **Overall Status**: Baseline Established (93.6% Coverage Accuracy / 93.7% Deductible Accuracy)

## Aggregate Metrics Summary

| Metric | Target Threshold | Measured Baseline | Status |
|---|---|---|---|
| **Coverage Accuracy** | ≥ 85.0% | **93.6%** | PASS |
| **Deductible Accuracy** | ≥ 80.0% | **93.7%** | PASS |
| **Uncategorized Rate** | ≤ 10.0% | **0.0%** | PASS |
| **Manual Completion Rate** | N/A | **13.3%** | INFORMATIONAL |
| **Correction Rate** | N/A | **6.4%** | INFORMATIONAL |

## Fixture Regression Analysis
The following 4 fixtures were flagged below the 85% coverage accuracy threshold during baseline creation and are queued for template tuning in Wave 2:

1. `bbva-007`: Coverage accuracy **83.3%**
2. `mapfre-001`: Coverage accuracy **83.3%**
3. `sbs-006`: Coverage accuracy **80.0%**
4. `sbs-007`: Coverage accuracy **83.3%**

## CI Consumption & Threshold Gate Recipe
To enforce this baseline in GitHub Actions CI:
```bash
# Run baseline evaluation
npm run evaluate:golden -- --report-file docs/golden-set-baseline.json
```
- CI passes when aggregate coverage accuracy is ≥ 85.0% and deductible accuracy is ≥ 80.0%.
