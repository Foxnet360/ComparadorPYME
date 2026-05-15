## ADDED Requirements

### Requirement: Detect sublimits and caps in clause documents
The system SHALL identify and extract sublimits, aggregate limits, and per-item caps from clause documents and quotes.

#### Scenario: Per-event sublimit
- **WHEN** a clause states "Tope máximo por evento: $100.000.000"
- **THEN** the system extracts: `{type: 'per_event', amount: 100000000, description: 'Tope máximo por evento'}`

#### Scenario: Per-item cap
- **WHEN** a clause states "Máximo por ítem: 10% del valor asegurado"
- **THEN** the system extracts: `{type: 'per_item', amount: 0.10, amountType: 'percentage', description: 'Máximo por ítem'}`

#### Scenario: Aggregate limit
- **WHEN** a clause states "Límite agregado anual: $1.000.000.000"
- **THEN** the system extracts: `{type: 'aggregate', amount: 1000000000, period: 'annual', description: 'Límite agregado anual'}`

#### Scenario: Deductible cap
- **WHEN** a deductible states "10% / Máx. 500 SMMLV"
- **THEN** the system extracts the cap as: `{type: 'deductible_cap', amount: 500, amountType: 'SMMLV', description: 'Tope de deducible'}`

### Requirement: Display sublimits in coverage matrix
The system SHALL display extracted sublimits as indicators in the coverage matrix cells.

#### Scenario: Sublimit indicator
- **WHEN** a coverage has an extracted sublimit
- **THEN** the cell shows the coverage value with a sublimit icon (e.g., 📎 or "T")
- **AND** hovering reveals the sublimit details

#### Scenario: No sublimit
- **WHEN** a coverage has no extracted sublimit
- **THEN** no sublimit indicator is displayed

### Requirement: Include sublimits in deductible risk analysis
The system SHALL consider sublimits when calculating deductible risk scores.

#### Scenario: Deductible with favorable cap
- **WHEN** a deductible is "10%" with cap "Máx. 100 SMMLV"
- **AND** the insured amount is $5.000.000.000
- **THEN** the effective deductible is capped at ~$130M instead of $500M
- **AND** the risk score improves (lower ratio)
