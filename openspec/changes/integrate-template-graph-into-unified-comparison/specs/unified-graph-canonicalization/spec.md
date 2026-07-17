# unified-graph-canonicalization Specification

## Purpose

Use `coverageGraphService` to canonicalize V2 comparison rows and link deductibles inside the unified engine post-processing pipeline, without overwriting the raw LLM output shown to users.

## Requirements

### Requirement: Post-parse canonical mapping

The system SHALL call `coverageGraphService.query(rawLabel, { insurer, domain: 'pyme' })` for each row label emitted by `flatTableParser.parseV2` and attach the highest-confidence mapping to the row object.

#### Scenario: Known raw label maps to canonical coverage

- GIVEN `parseV2` emits a row labeled `Daño Material Global` for a BBVA quote
- WHEN `coverageGraphService.query` returns `Amparo básico todo riesgo` with confidence 0.92
- THEN the row SHALL have `canonicalName: 'Amparo básico todo riesgo'`, `canonicalId: 'amparo-basico-todo-riesgo'`, and `canonicalSource: 'graph'`.

#### Scenario: Unknown raw label remains uncanonicalized

- GIVEN `parseV2` emits a row labeled `Cobertura Adicional Especial`
- WHEN `coverageGraphService.query` returns an empty mapping list
- THEN the row SHALL keep `canonicalName` undefined and `canonicalSource: 'alias'` or `uncanonicalized: true`.

### Requirement: Deductible canonical linking

For each DEDUCIBLES row, the system SHALL call `coverageGraphService.queryDeductible(rawText, { insurer })` and attach `appliesTo` canonical coverage IDs to the structured `deductible` object.

#### Scenario: Deductible linked to a coverage

- GIVEN a deductible row contains `10% mínimo 5 SMMLV - Amparo básico`
- WHEN `queryDeductible` returns `appliesTo: 'Amparo básico todo riesgo'` with confidence 0.88
- THEN the cell SHALL include `deductible.appliesTo: ['Amparo básico todo riesgo']`.

#### Scenario: No link found

- GIVEN a deductible text has no matching graph edge
- WHEN `queryDeductible` returns an empty array
- THEN the structured deductible SHALL have no `appliesTo` field.

### Requirement: Canonical ordering in matrix

`matrixTransformer.flatResultToMatrixRowsV2` SHALL use `canonicalId` to sort rows within each section according to the canonical 14 PYME category order when canonical metadata is present.

#### Scenario: Rows ordered by canonical category

- GIVEN rows with canonical IDs `terremoto`, `amparo-basico-todo-riesgo`, and `rce`
- WHEN the matrix is built
- THEN `amparo-basico-todo-riesgo` SHALL appear before `terremoto`, which SHALL appear before `rce`.

### Requirement: Raw labels preserved as visible truth

The system SHALL NOT change `row.label`, `cell.value`, or `cell.rawText` after canonicalization; canonical metadata SHALL only affect ordering, comparison, and `canonicalName` fields consumed by downstream reporting.

#### Scenario: UI displays raw label

- GIVEN a row was canonicalized to `Responsabilidad Civil Extracontractual (RCE)`
- WHEN the matrix is rendered
- THEN the visible label SHALL be the original raw text, not the canonical name.
