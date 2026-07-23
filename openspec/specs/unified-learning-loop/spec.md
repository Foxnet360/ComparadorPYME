# unified-learning-loop Specification

## Purpose

Remediate the unified learning loop and integration path introduced by "Integrate Template Registry and Coverage Graph into Unified Comparison". This delta covers the 4R review findings and the unimplemented Phase 4 (learning loop) and Phase 5 (integration) work.

## ADDED Requirements

### Requirement: Measurement harness ignores small samples

The template-hint measurement harness SHALL NOT evaluate the p95 token or latency increase unless at least 10 observations have been recorded for the insurer.

#### Scenario: Single outlier does not disable hints

- GIVEN insurer BBVA has 1 recorded observation with tokens 2x the baseline
- WHEN `shouldDisable('BBVA')` is evaluated
- THEN `disabled` SHALL be `false`
- AND the reason SHALL be undefined.

### Requirement: Percentile calculation handles small N

The percentile calculation used by the measurement harness SHALL return a value that is not simply the maximum sample when N is below the evaluation threshold.

#### Scenario: p95 for N=5 is not the maximum

- GIVEN 5 latency observations `[10, 20, 30, 40, 50]`
- WHEN p95 is computed
- THEN the result SHALL be between the 90th and 100th percentile values (e.g., 40 or a weighted value)
- AND SHALL NOT equal 50 unless the correct percentile index resolves to 50.

### Requirement: Baseline reset clears disable decisions

When `setBaseline(insurer, baseline)` is called, the measurement harness SHALL clear any existing per-insurer disable decision so new baselines do not inherit stale guardrail states.

#### Scenario: Baseline reset after guardrail trip

- GIVEN `shouldDisable('BBVA')` returned `true` due to a token increase
- WHEN `setBaseline('BBVA', { tokens: 100, latencyMs: 200 })` completes
- THEN a subsequent `shouldDisable('BBVA')` SHALL be based on the new baseline and recorded samples
- AND the prior disable decision SHALL NOT affect the result.

### Requirement: Measurement harness uses resilient cache wrapper

The measurement harness SHALL use the project's `redisCache` wrapper for all Redis operations instead of raw `ioredis` calls.

#### Scenario: Redis operation failure is handled

- GIVEN `redisCache.zadd` rejects due to a transient Redis error
- WHEN `recordObservation` is called
- THEN the operation SHALL NOT crash the request
- AND the harness SHALL degrade gracefully.

### Requirement: Anonymous users are excluded from rollout hashing

When the current request has no authenticated user, the comparison engine adapter SHALL treat the user as ineligible for any graph or template-hint rollout and SHALL NOT pass a synthetic user identifier such as `'anonymous'` to the hash function.

#### Scenario: Unauthenticated analyze request

- GIVEN a `POST /api/analyze` request without an authenticated user
- WHEN `comparisonEngineAdapter.generateComparison` evaluates rollouts
- THEN `graphEnabled` SHALL be `false`
- AND `templateHintsEnabled` SHALL be `false`
- AND `hashUserId` SHALL NOT be called with `'anonymous'`.

#### Scenario: Authenticated user remains eligible

- GIVEN a `POST /api/analyze` request with an authenticated userId `user-123`
- WHEN the adapter evaluates rollouts
- THEN `hashUserId('user-123')` SHALL be compared against the configured percentage
- AND the slice flags MAY be `true` depending on the rollout.

### Requirement: Coverage mapping corrections bypass legacy flag gate

The `learningEngine.applyCorrection` function SHALL route `coverage_mapping` corrections to `coverageGraphService.learnCorrection` regardless of the legacy `graphLearningEnabled` flag.

#### Scenario: Correction with graph learning disabled

- GIVEN the legacy `graphLearningEnabled` flag is `false`
- AND a `coverage_mapping` correction is saved for raw `Daño Material Global` → canonical `Amparo básico todo riesgo` for BBVA
- WHEN `applyCorrection` executes
- THEN `coverageGraphService.learnCorrection` SHALL be called
- AND a `learned` edge SHALL be created or updated.

### Requirement: First human correction produces strong learned edge

A human correction (`user_corrected=true`) for a coverage mapping SHALL create or update a `learned` edge with weight >= 0.7.

#### Scenario: First human correction weight

- GIVEN a new raw-to-canonical pair for a coverage_mapping correction
- WHEN the correction is saved with `user_corrected=true`
- THEN the resulting `learned` edge weight SHALL be >= 0.7.

### Requirement: Graph cache invalidation after learning

After `coverageGraphService.learnCorrection` or `addEdge` writes a new `learned` edge, the system SHALL invalidate cached query results for the affected raw name, insurer, and domain so the next comparison request observes the learned mapping.

#### Scenario: New mapping visible on next request

- GIVEN a new learned edge is written for raw name `Daño Material Global`, insurer BBVA, domain `pyme`
- WHEN `invalidateCache('Daño Material Global', 'BBVA', 'pyme')` completes
- THEN keys matching `graph:query:Daño Material Global:BBVA:pyme:*` and `graph:deductible:Daño Material Global:BBVA:*` SHALL be deleted
- AND the next `coverageGraphService.query('Daño Material Global', { insurer: 'BBVA', domain: 'pyme' })` SHALL read from the database.

### Requirement: Analysis report exposes canonical metadata

When the unified comparison engine runs with graph canonicalization enabled, the generated report SHALL include `canonicalName`, `matchConfidence`, and `matchMethod` for each coverage while preserving the raw user-facing label.

#### Scenario: Report includes canonical metadata

- GIVEN `/api/analyze` returns a unified comparison result with graph enabled
- WHEN the report is built
- THEN each coverage item SHALL contain `canonicalName`, `matchConfidence`, and `matchMethod`
- AND the coverage `label` SHALL remain the raw LLM output.

### Requirement: Golden-set evaluation segments by slice flags

The `runEvaluation` golden-set harness SHALL segment accuracy results by the `graphEnabled` and `templateHintsEnabled` flags so each slice can be evaluated independently.

#### Scenario: Segment accuracy by flags

- GIVEN a golden set with 40 rows
- WHEN `runEvaluation` completes
- THEN results SHALL include accuracy metrics for at least the combinations `{ graphEnabled: false, templateHintsEnabled: false }` and `{ graphEnabled: true, templateHintsEnabled: true }`
- AND the metrics SHALL be computed from the rows that used the corresponding flag values.

## MODIFIED Requirements

### Requirement: Human correction creates graph edge

This requirement replaces the corresponding requirement from the archived "Integrate Template Registry and Coverage Graph into Unified Comparison" change.

The system SHALL route coverage_mapping corrections from `learningEngine.saveCorrection()` through `coverageGraphService.learnCorrection(raw, canonical, insurer, 'pyme')` within 24 hours of the correction being saved. The routing SHALL NOT be gated by the legacy `graphLearningEnabled` flag for coverage mapping corrections.

#### Scenario: Analyst corrects a coverage mapping

- GIVEN an analyst maps raw label `Daño Material Global` to `Amparo básico todo riesgo` for BBVA
- WHEN `saveCorrection` is called
- THEN `applyCorrection` SHALL call `coverageGraphService.learnCorrection` with those values
- AND a `learned` edge SHALL be created or updated in `coverage_graph_edges`.

#### Scenario: Repeated correction increases weight

- GIVEN a `learned` edge for `Daño Material Global → Amparo básico todo riesgo` already exists with correction count 3
- WHEN another correction is saved for the same pair
- THEN `correction_count` SHALL become 4
- AND the edge weight SHALL increase according to `correctionBoost`.

### Requirement: Distinguish strong and automated signals

This requirement replaces the corresponding requirement from the archived change.

Human corrections SHALL create `learned` edges with weight >= 0.7. Automated evaluation signals (e.g., golden-set matches) SHALL create `learned` or `maps_to` edges with weight >= 0.5 and a distinct provenance tag.

#### Scenario: Human correction is strong signal

- GIVEN a correction is saved with `user_corrected=true`
- WHEN `updateGraph` is called
- THEN the resulting edge weight SHALL be >= 0.7.

#### Scenario: Automated evaluation is weaker signal

- GIVEN a golden-set evaluation confirms a raw-to-canonical match
- WHEN the system writes the signal to the graph
- THEN the edge SHALL have `provenance: 'automated_evaluation'` and weight >= 0.5.

### Requirement: Cache invalidation after learning

This requirement replaces the corresponding requirement from the archived change.

After `coverageGraphService.learnCorrection` or `addEdge` writes a new edge, the system SHALL invalidate cached query results for the affected raw name, insurer, and domain so the next comparison request sees the learned mapping.

#### Scenario: Learned mapping visible immediately after cache invalidation

- GIVEN a new learned edge is written for raw name `Daño Material Global` and insurer BBVA
- WHEN `invalidateCache('Daño Material Global', 'BBVA', 'pyme')` completes
- THEN the next `coverageGraphService.query('Daño Material Global', { insurer: 'BBVA', domain: 'pyme' })` SHALL read from the database
- AND the learned mapping SHALL be returned.

### Requirement: Slice 3 success target

This requirement replaces the corresponding requirement from the archived change.

The system SHALL ensure that corrections saved through the unified learning path create graph edges within 24 hours, as measured by the timestamp of the edge row or the cache invalidation event. The path SHALL bypass the legacy `graphLearningEnabled` flag for `coverage_mapping` corrections.

#### Scenario: Correction within SLA

- GIVEN a correction is saved at time T
- WHEN the edge is queried at time T + 23 hours
- THEN the edge SHALL exist with `updated_at` or `created_at` <= T + 1 hour.