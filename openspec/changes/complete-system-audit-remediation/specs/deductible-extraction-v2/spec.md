## MODIFIED Requirements

### Requirement: Fallback inteligente basado en tipo de cobertura
El system SHALL usar lógica de fallback que distinga entre "sin deducible" y "no encontrado". **ADDED**: The system SHALL use the current SMMLV value for all deductible calculations involving SMMLV.

#### Scenario: SMMLV-based deductible calculation
- **WHEN** a deductible is "5 SMMLV"
- **AND** the current SMMLV is 1,423,500
- **THEN** the calculated deductible SHALL be 7,117,500
- **AND** SHALL NOT use outdated hardcoded values

#### Scenario: SMMLV configuration change
- **WHEN** the SMMLV environment variable is updated
- **THEN** all new analyses SHALL use the updated value
- **AND** historical analyses SHALL NOT be retroactively modified

### Requirement: Validación de formatos de deducible colombianos
El system SHALL reconocer formatos comunes de deducibles en cotizaciones colombianas. **ADDED**: The system SHALL handle all formats with the current UVT value.

#### Scenario: UVT-based deductible
- **WHEN** a deductible is "10 UVT"
- **AND** the current UVT is 42,412
- **THEN** the calculated deductible SHALL be 424,120
- **AND** SHALL NOT use outdated hardcoded values
