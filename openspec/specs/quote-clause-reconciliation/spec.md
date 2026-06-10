# Spec: Quote-Clause Reconciliation

## Capability
Deep comparison of quote deductibles against clause RAG results, surfacing discrepancies for broker review.

## Requirements

### Requirement: Compare Deductibles
Quote deductibles MUST be compared against clause RAG results.

#### Scenario: Match
- **WHEN** the quote deductible is "10% min 5 SMMLV" and the clause deductible is "10% mínimo 5 SMMLV"
- **THEN** no discrepancy flag is raised.

#### Scenario: Mismatch
- **WHEN** the quote deductible is "0%" and the clause deductible is "10%"
- **THEN** a discrepancy flag is raised for broker review.

#### Scenario: Missing Clause
- **WHEN** no clause is found for the insurer
- **THEN** the status is flagged as "verification pending".

### Requirement: Flag Discrepancies
Mismatches MUST be surfaced in the UI for broker review with confidence scores.

#### Scenario: Discrepancy Alert
- **WHEN** a mismatch is detected between quote and clause deductibles
- **THEN** the UI displays the discrepancy with a confidence score
- **AND** the broker can review and resolve it.

### Requirement: Configurable Thresholds
Reconciliation thresholds SHOULD be configurable per insurer and product.

#### Scenario: Per-Insurer Threshold
- **WHEN** reconciling deductibles for different insurers
- **THEN** the system applies insurer-specific thresholds loaded from configuration.
