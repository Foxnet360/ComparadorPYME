# Delta for comparison-engine-adapter

## ADDED Requirements

### Requirement: Independent percentage rollout per integration slice

The system SHALL extend `comparisonEngineAdapter.generateComparison` to evaluate independent percentage-based rollouts for `useUnifiedGraphCanonicalization` and `useUnifiedTemplateHints` using the same deterministic user-hash strategy already implemented in `UnifiedComparisonFeatureFlag`, without requiring a deploy.

#### Scenario: Slice enabled for user

- GIVEN `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=50` and the hashed user ID falls below 50
- WHEN `generateComparison` is called
- THEN the adapter SHALL route to the unified engine with graph canonicalization enabled
- AND it SHALL log `graphEnabled=true`.

#### Scenario: Slice disabled for user

- GIVEN `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=0`
- WHEN `generateComparison` is called
- THEN the adapter SHALL route to the unified engine with graph canonicalization disabled
- AND it SHALL log `graphEnabled=false`.

### Requirement: Rollout decision metrics and observability

The adapter SHALL emit structured logs and metrics for each slice decision (`graphEnabled`, `templateHintsEnabled`) so that golden-set evaluation can segment results by slice.

#### Scenario: Request tagged with slice flags

- GIVEN a request is processed with `graphEnabled=true` and `templateHintsEnabled=false`
- WHEN the adapter returns a result
- THEN the returned `ComparisonAdapterResult` SHALL include `graphEnabled` and `templateHintsEnabled` flags
- AND the correlation log SHALL contain `routing=unified, graphEnabled=true, templateHintsEnabled=false`.

### Requirement: Legacy fallback remains unchanged

New slice flags SHALL NOT modify the legacy fallback path. When the unified engine fails, the adapter SHALL still call `processQuotesBatch` and return `engine: 'fallback'` with a fallback reason.

#### Scenario: Unified engine fails while graph slice is enabled

- GIVEN `graphEnabled=true` and the unified engine throws `UnifiedComparisonError`
- WHEN the adapter catches the error
- THEN it SHALL route to `processQuotesBatch`
- AND the response SHALL have `engine: 'fallback'` and the original error reason.

### Requirement: Granular schema compatibility

Slice flags SHALL only affect the V2 granular path (`granularComparisonSchema=true`). When V1 schema is used, graph canonicalization and template hints SHALL be disabled.

#### Scenario: V1 schema request

- GIVEN `granularComparisonSchema=false` and `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=100`
- WHEN `generateComparison` is called
- THEN the adapter SHALL force `graphEnabled=false` and `templateHintsEnabled=false`.
