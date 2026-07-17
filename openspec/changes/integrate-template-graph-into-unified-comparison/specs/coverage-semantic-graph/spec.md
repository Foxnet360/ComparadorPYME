# Delta for coverage-semantic-graph

## ADDED Requirements

### Requirement: Query result preserves raw label

`coverageGraphService.query(rawName, options)` SHALL return the original `rawName` in `GraphQueryResult` so consumers can preserve user-visible labels while applying canonical mappings.

#### Scenario: Query result includes raw name

- GIVEN a query for `Daño Material Global` returns mappings
- WHEN the result is consumed by `flatTableParser`
- THEN `result.rawName` SHALL equal `Daño Material Global`.

#### Scenario: Empty result still carries raw name

- GIVEN a query for an unknown term returns no mappings
- THEN `result.rawName` SHALL still equal the queried term.

### Requirement: Deductible query supports raw deductible text

`coverageGraphService.queryDeductible(deductibleText, options)` SHALL accept raw deductible strings and return ranked `GraphDeductibleLink` objects with `deductibleText`, `appliesTo`, and `confidence`.

#### Scenario: Deductible linked to canonical coverage

- GIVEN `queryDeductible('10% - Amparo básico', { insurer: 'BBVA' })`
- WHEN matching `deductible_for` or `applies_to` edges exist
- THEN the result SHALL contain `appliesTo: 'Amparo básico todo riesgo'` and a confidence score.

#### Scenario: Insurer-specific edge preferred

- GIVEN both global and BBVA-specific edges exist for the same deductible text
- WHEN `queryDeductible` is called with `insurer: 'BBVA'`
- THEN the BBVA-specific edge SHALL be returned first and receive higher confidence.

### Requirement: Cache invalidation on learned edges

When `learnCorrection` or `addEdge` writes a new edge, the service SHALL invalidate cached query results for the affected `rawName`, `insurer`, and `domain` combination.

#### Scenario: New correction becomes visible within 24 hours

- GIVEN `learnCorrection('Daño Material Global', 'Amparo básico todo riesgo', 'BBVA')` succeeds
- WHEN `query('Daño Material Global', { insurer: 'BBVA' })` is called afterwards
- THEN the cached value for that key SHALL be deleted
- AND the next query SHALL read from the database.
