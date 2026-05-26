## ADDED Requirements

### Requirement: Parse compound deductible structures
The system SHALL parse complex deductible expressions including percentages, minimums, maximums, and fixed amounts.

#### Scenario: Parse compound deductible
- **WHEN" the text "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" is found
- **THEN** the system extracts:
  - Component 1: {type: "percentage", value: 10}
  - Component 2: {type: "minimum", value: 5, currency: "SMMLV"}
  - Component 3: {type: "maximum", value: 50, currency: "SMMLV"}
  - Normalized: {minAmount: 6500000, maxAmount: 65000000, percentage: 10}

### Requirement: Handle ambiguous deductible expressions
The system SHALL handle various deductible expressions including "sin aplicación", "Mínimo", "NO APLICA", and regional variants.

#### Scenario: Parse "sin aplicación de deducible"
- **WHEN" the text "sin aplicación de deducible" is found
- **THEN** the system returns:
  - isZero: true
  - components: [{type: "na", value: 0}]
  - normalized: {minAmount: 0, maxAmount: 0, percentage: 0}

### Requirement: Provide deductible benchmarks by risk type
The system SHALL include market benchmarks to evaluate whether a deductible is favorable.

#### Scenario: Evaluate terremoto deductible
- **WHEN" a deductible of "10% min 5 SMMLV" for Terremoto is parsed
- **THEN** the system compares against benchmarks:
  - Market standard: "10% min 5 SMMLV"
  - Evaluation: "Estándar de mercado"
- **AND** for "10% min 2 SMMLV", it flags as "Mejor que el estándar"

### Requirement: Calculate expected deductible cost
The system SHALL calculate the expected annual cost of deductibles based on claim probability and average claim amounts.

#### Scenario: Calculate expected cost
- **WHEN" a deductible structure and risk profile are provided
- **THEN** the system calculates:
  - Expected deductible per claim: min(max(minAmount, percentage * avgClaim), maxAmount)
  - Annual expected cost: expectedDeductible * claimProbability
- **AND** displays this alongside the raw deductible for context
