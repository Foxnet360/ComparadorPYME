# Delta for Extraction Quality Evaluation

## MODIFIED Requirements

### Requirement: Fixed quote set baseline

The system SHALL store a fixed set of 3 quote PDFs and a direct-chat prompt that requests a granular, section-aware comparison table with canonical sub-rows.

(Previously: the baseline prompt requested the four-row comparison table.)

#### Scenario: Baseline generation

- GIVEN the fixed 3-quote set
- WHEN the harness calls Gemini with the direct-chat granular prompt and all PDFs
- THEN it SHALL capture the baseline table cells
- AND it SHALL persist the baseline for reproducible comparisons
- AND the baseline rows MAY vary in count and section

### Requirement: Tool path comparison

The system SHALL run the same 3-quote set through `/api/analyze` using the unified engine under the `granularComparisonSchema` flag.

#### Scenario: Tool extraction

- GIVEN the fixed 3-quote set
- WHEN the harness POSTs the PDFs to `/api/analyze` with the flag enabled
- THEN it SHALL receive the tool output table
- AND it SHALL map tool cells to baseline cells by canonical row label and insurer column

### Requirement: Cell-level metric

The system SHALL compute the percentage of matching cells between baseline and tool output, aligning rows by canonical label and allowing variable row counts.

(Previously: required the same insurers and rows and compared fixed coordinates.)

#### Scenario: Match calculation

- GIVEN baseline and tool tables with the same insurers and canonical row labels
- WHEN the metric runs
- THEN it SHALL count cells with equivalent semantic content as matches
- AND it SHALL report mismatches with row label, column, baseline, and tool values
- AND the match rate SHALL be >= 90% for the first slice

### Requirement: Regression guard

The system SHALL run the evaluation harness as part of the Vitest suite and assert the match rate for the granular baseline.

#### Scenario: CI execution

- GIVEN the harness is invoked by `npm test`
- WHEN the comparison completes
- THEN it SHALL assert match rate >= 90%
- AND it SHALL fail the test if the unified engine fallback rate exceeds 10%
