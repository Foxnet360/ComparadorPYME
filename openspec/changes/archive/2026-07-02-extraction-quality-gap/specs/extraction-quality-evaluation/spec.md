# Spec: Extraction Quality Evaluation

## Purpose

Provide a repeatable harness that runs a fixed quote set through both the direct-chat baseline prompt and the production tool path, then reports cell-level agreement.

## Requirements

### Requirement: Fixed quote set baseline

The system SHALL store a fixed set of 3 quote PDFs and a direct-chat prompt that requests the four-row comparison table.

#### Scenario: Baseline generation

- GIVEN the fixed 3-quote set
- WHEN the harness calls Gemini with the direct-chat prompt and all PDFs
- THEN it SHALL capture the baseline table cells
- AND it SHALL persist the baseline for reproducible comparisons

### Requirement: Tool path comparison

The system SHALL run the same 3-quote set through `/api/analyze` using the unified engine.

#### Scenario: Tool extraction

- GIVEN the fixed 3-quote set
- WHEN the harness POSTs the PDFs to `/api/analyze`
- THEN it SHALL receive the tool output table
- AND it SHALL map tool cells to the same row/column coordinates as the baseline

### Requirement: Cell-level metric

The system SHALL compute the percentage of matching cells between baseline and tool output.

#### Scenario: Match calculation

- GIVEN baseline and tool tables with the same insurers and rows
- WHEN the metric runs
- THEN it SHALL count cells with equivalent semantic content as matches
- AND it SHALL report mismatches with row, column, baseline, and tool values
- AND the match rate SHALL be >= 90% for the first slice

### Requirement: Regression guard

The system SHALL run the evaluation harness as part of the Vitest suite.

#### Scenario: CI execution

- GIVEN the harness is invoked by `npm test`
- WHEN the comparison completes
- THEN it SHALL assert match rate >= 90%
- AND it SHALL fail the test if the unified engine fallback rate exceeds 10%
