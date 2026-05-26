## ADDED Requirements

### Requirement: Analyze compound deductible structures
The system SHALL analyze complex deductible structures with multiple components (percentage, minimum, maximum).

#### Scenario: Analyze compound deductible
- **WHEN" a deductible of "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" is analyzed
- **THEN** the system evaluates each component:
  - Percentage: 10% (standard)
  - Minimum: 5 SMMLV ($6.5M) (elevated)
  - Maximum: 50 SMMLV ($65M) (protective)
- **AND" provides a composite risk assessment

### Requirement: Compare deductibles against market benchmarks
The system SHALL evaluate deductibles against market benchmarks by risk type.

#### Scenario: Benchmark comparison
- **WHEN" analyzing a deductible for "Terremoto"
- **THEN" the system compares against benchmarks:
  - Market standard: 10% min 5 SMMLV
  - Current: 10% min 5 SMMLV
  - Assessment: "Standard market deductible"

### Requirement: Calculate expected deductible cost
The system SHALL calculate the expected annual cost of deductibles.

#### Scenario: Expected cost calculation
- **WHEN" a deductible structure and risk profile are provided
- **THEN** the system calculates expected cost per claim
- **AND** annualizes it based on claim probability

## MODIFIED Requirements

### Requirement: Parse deductible values from text
The system SHALL extract deductible values from text using regex patterns.

#### Scenario: Parse simple deductible
- **WHEN** a deductible text like "10%" or "5 SMMLV" is found
- **THEN** the system extracts the numeric value and type
- **AND" normalizes it to a standard format

### Requirement: Calculate deductible risk score
The system SHALL calculate a risk score for each deductible based on the deductible amount relative to insured value.

#### Scenario: Risk score calculation
- **WHEN** a deductible and insured amount are provided
- **THEN** the system calculates the deductible ratio
- **AND" assigns a risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **AND" generates a recommendation

## REMOVED Requirements

### Requirement: Use simple regex for all deductible parsing
**Reason**: Replaced by semantic parser for compound structures
**Migration**: Use semantic parser for complex deductibles, regex for simple cases only
