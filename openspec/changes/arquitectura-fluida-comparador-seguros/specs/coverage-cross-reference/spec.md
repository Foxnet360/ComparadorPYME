## ADDED Requirements

### Requirement: Cross-reference coverage variables
The system SHALL cross-reference coverage variables (value, deductible, sublimit, exclusions) between quotes and clauses.

#### Scenario: Variable cross-reference
- **WHEN** comparing a quote's "AMPARO BASICO" with clause data
- **THEN" the system checks:
  - Insured amount consistency
  - Deductible agreement
  - Sublimit alignment
  - Exclusion compatibility

### Requirement: Identify discrepancies at variable level
The system SHALL identify discrepancies between quotes and clauses at the variable level.

#### Scenario: Variable discrepancy detection
- **WHEN** a quote states deductible "10%" but clause states "10% min 5 SMMLV"
- **THEN** the system flags the missing minimum as a discrepancy
- **AND" assigns severity based on financial impact

## MODIFIED Requirements

### Requirement: Cross-reference quote coverages with clause documents
The system SHALL verify that quote coverages exist in clause documents.

#### Scenario: Coverage existence check
- **WHEN** a quote includes "Responsabilidad Civil"
- **THEN** the system searches clause documents for this coverage
- **AND" marks it as verified if found
- **OR" flags it as phantom if not found

### Requirement: Detect deductible discrepancies
The system SHALL compare quote deductibles against clause deductibles.

#### Scenario: Deductible comparison
- **WHEN** a quote deductible differs from the clause deductible
- **THEN** the system generates an alert:
  - If quote deductible is lower: "Potentially favorable - verify with insurer"
  - If quote deductible is higher: "Less favorable than standard"

## REMOVED Requirements

### Requirement: Compare only canonical coverage categories
**Reason**: Replaced by variable-level comparison across semantic groups
**Migration**: Compare variables directly rather than forcing canonical categories first
