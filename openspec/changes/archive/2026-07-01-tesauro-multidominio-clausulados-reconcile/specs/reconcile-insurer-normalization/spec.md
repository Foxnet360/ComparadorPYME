# Delta for Quote-Clause Reconciliation

## MODIFIED Requirements

### Requirement: Compare Deductibles
Quote deductibles MUST be compared against clause RAG results. Before searching for clauses, the system SHALL normalize insurer names using the insurerNameNormalizer mapping to prevent MISSING_CLAUSE errors caused by name variations.
(Previously: Insurer names were passed raw to searchClause(), causing mismatches between quote extraction output and structured_clauses storage.)

#### Scenario: Match
- **WHEN** the quote deductible is "10% min 5 SMMLV" and the clause deductible is "10% mínimo 5 SMMLV"
- **THEN** no discrepancy flag is raised.

#### Scenario: Mismatch
- **WHEN** the quote deductible is "0%" and the clause deductible is "10%"
- **THEN** a discrepancy flag is raised for broker review.

#### Scenario: Missing Clause
- **WHEN** no clause is found for the insurer
- **THEN** the status is flagged as "verification pending".

#### Scenario: Normalized insurer name match
- **GIVEN** a quote contains insurer name "SBS SEGUROS COLOMBIA S.A."
- **WHEN** reconciliation begins
- **THEN** the system SHALL normalize the name to "SBS" via insurerNameNormalizer
- **AND** searchClause() SHALL use the normalized name
- **AND** the clause SHALL be found if it exists in structured_clauses

#### Scenario: Unmapped insurer name
- **GIVEN** a quote contains an insurer name not present in INSURER_NAME_MAPPINGS
- **WHEN** reconciliation begins
- **THEN** the system SHALL pass the raw name to searchClause()
- **AND** log a warning with the unmapped name for telemetry

#### Scenario: Missing clause after normalization
- **GIVEN** insurer name is normalized successfully
- **WHEN** no clause is found for the normalized insurer
- **THEN** the status SHALL be flagged as "verification pending"
- **AND** the normalized name SHALL be included in the discrepancy report

## ADDED Requirements

### Requirement: Insurer name normalization telemetry
The system SHOULD log unmapped insurer names to enable mapping expansion.

#### Scenario: Unmapped name telemetry
- **GIVEN** an unmapped insurer name is encountered during reconciliation
- **WHEN** reconciliation completes
- **THEN** the unmapped name SHALL be logged with frequency count
- **AND** operations staff MAY review logs to add new mappings
