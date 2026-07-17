# Delta for unified-comparison-extraction

## ADDED Requirements

### Requirement: Graph canonicalization post-parsing

The system SHALL, after `flatTableParser.parseV2` emits V2 rows, query `coverageGraphService.query(rawLabel, { insurer, domain: 'pyme' })` for each row label and attach the highest-confidence canonical mapping as metadata when graph confidence exceeds the alias-only baseline.

#### Scenario: Graph maps a known alias

- GIVEN `parseV2` emits a row labeled `Daño Material Global` for a BBVA quote
- WHEN `coverageGraphService.query` returns `Amparo básico todo riesgo` with confidence 0.92
- THEN the row metadata SHALL include `canonicalName: 'Amparo básico todo riesgo'` and `matchMethod: 'graph'`
- AND the visible `label` and cell `value` SHALL remain unchanged.

#### Scenario: Graph confidence below alias baseline

- GIVEN `parseV2` emits a row labeled `Cobertura Especial X`
- WHEN `coverageGraphService.query` returns no mapping with confidence above 0.5
- THEN the row SHALL keep its raw label and be marked `uncanonicalized: true`
- AND the existing `normalizeAlias` path SHALL NOT be blocked.

### Requirement: Deductible linking via graph

The system SHALL query `coverageGraphService.queryDeductible(rawDeductibleText, { insurer })` for each DEDUCIBLES row and attach `appliesTo` canonical coverage IDs to the structured `deductible` object produced by `parseDeductible`.

#### Scenario: Deductible linked to a coverage

- GIVEN a deductible row contains `Deducible 10% - Amparo básico`
- WHEN `queryDeductible` returns `appliesTo: 'Amparo básico todo riesgo'` with confidence 0.88
- THEN the cell SHALL include `deductible.appliesTo: 'Amparo básico todo riesgo'`.

#### Scenario: No deductible link found

- GIVEN a deductible row has no matching graph edge
- WHEN `queryDeductible` returns an empty array
- THEN the cell SHALL keep the parsed `deductible` object without `appliesTo`.

### Requirement: Raw labels remain user-visible truth

The system SHALL NOT overwrite `row.label`, `cell.value`, or `cell.rawText` with canonical names; canonical mapping SHALL only populate `canonicalName`/`canonicalId` metadata used by `matrixTransformer` and `analysisController.matrixRowsToComparisonReport` for ordering and comparison.

#### Scenario: Matrix still shows insurer wording

- GIVEN a row was canonicalized to `Responsabilidad Civil Extracontractual (RCE)`
- WHEN `flatResultToMatrixRowsV2` renders the matrix
- THEN the UI label SHALL display the original raw label, not the canonical name.

### Requirement: Uncovered insurers fall back to alias-only normalization

When `coverageGraphService.query` returns no mapping and no insurer template is active, the system SHALL use the existing `normalizeAlias` path in `flatTableParser` and mark the row `canonicalSource: 'alias'` or `uncanonicalized`.

#### Scenario: Generic insurer with no graph data

- GIVEN an uploaded quote from an insurer without graph edges or template
- WHEN `parseV2` processes the response
- THEN rows SHALL be normalized via `normalizeAlias` only
- AND `canonicalSource` SHALL NOT be `'graph'`.
