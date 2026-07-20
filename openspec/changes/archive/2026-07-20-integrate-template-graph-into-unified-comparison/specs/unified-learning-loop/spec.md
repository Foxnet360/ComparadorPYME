# unified-learning-loop Specification

## Purpose

Route human corrections and automated evaluation signals into the coverage semantic graph via `learningEngine` and `coverageGraphService.learnCorrection` so the unified comparison engine improves over time.

## Requirements

### Requirement: Human correction creates graph edge

The system SHALL route coverage_mapping corrections from `learningEngine.saveCorrection()` through `coverageGraphService.learnCorrection(raw, canonical, insurer, 'pyme')` within 24 hours of the correction being saved.

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

After `coverageGraphService.learnCorrection` or `addEdge` writes a new edge, the system SHALL invalidate cached query results for the affected raw name, insurer, and domain so the next comparison request sees the learned mapping.

#### Scenario: Learned mapping visible immediately after cache invalidation

- GIVEN a new learned edge is written for raw name `Daño Material Global` and insurer BBVA
- WHEN `invalidateCache('Daño Material Global', 'BBVA', 'pyme')` completes
- THEN the next `coverageGraphService.query('Daño Material Global', { insurer: 'BBVA' })` SHALL read from the database
- AND the learned mapping SHALL be returned.

### Requirement: Slice 3 success target

The system SHALL ensure that corrections saved through the unified learning path create graph edges within 24 hours, as measured by the timestamp of the edge row or the cache invalidation event.

#### Scenario: Correction within SLA

- GIVEN a correction is saved at time T
- WHEN the edge is queried at time T + 23 hours
- THEN the edge SHALL exist with `updated_at` or `created_at` <= T + 1 hour.
