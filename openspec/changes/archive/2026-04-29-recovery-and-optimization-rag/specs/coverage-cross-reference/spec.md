## ADDED Requirements

### Requirement: Coverage-based clause retrieval
The system SHALL retrieve relevant clause sections for each coverage found in a quote.

#### Scenario: Matching coverage to clauses
- **WHEN** a quote contains coverage "Incendio (Edificio y Contenidos)"
- **THEN** the system searches clause_chunks for that coverage tag
- **AND** filters by the quote's insurer_name
- **AND** returns the most relevant clause sections

#### Scenario: Cross-insurer clause lookup
- **WHEN** no clauses exist for the quote's insurer
- **THEN** the system falls back to generic clauses from other insurers
- **AND** flags the result as "generic reference, verify with insurer"

### Requirement: Deducible comparison
The system SHALL compare deductibles stated in the quote against those in the clause document.

#### Scenario: Discrepancy detection
- **WHEN** a quote states deducible "5%" for Incendio
- **AND** the clause states deducible "10%" for Incendio
- **THEN** the system generates a CRITICAL alert
- **AND** includes both values in the discrepancy report

#### Scenario: Matching values
- **WHEN** quote and clause deductibles match
- **THEN** no alert is generated
- **AND** the system notes "Verified against clause" in the analysis

### Requirement: Exclusion awareness
The system SHALL identify relevant exclusions from clauses for each coverage.

#### Scenario: Exclusion found
- **WHEN** a quote includes "Robo Mercancías"
- **AND** the clause has exclusion "Mercancías en tránsito no cubiertas"
- **THEN** the system generates a WARNING alert
- **AND** quotes the relevant clause text

#### Scenario: No relevant exclusion
- **WHEN** no exclusions are found for a coverage
- **THEN** the system proceeds without exclusion alerts
- **AND** notes "No exclusions found" in the analysis