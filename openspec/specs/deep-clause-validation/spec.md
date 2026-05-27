# Spec: Deep Clause Validation

## Capability
Validación de deducibles y coberturas ambiguas contra clausulados de aseguradoras cuando están disponibles, operando como una segunda pasada opcional sobre el resultado de la comparación unificada.

## Requirements

### Requirement: Clause-enhanced validation
The system SHALL validate comparison results against clause PDFs when provided, resolving ambiguous entries and confirming deductible accuracy.

#### Scenario: Ambiguous deductible resolution
- **WHEN** the comparison result contains a deductible marked as "Ver condiciones" for an insurer
- **AND** clause PDFs are available for that insurer
- **THEN** the system SHALL process the clause PDF with a validation prompt
- **AND** it SHALL extract the specific deductible from the clause
- **AND** it SHALL update the comparison result with the resolved deductible
- **AND** it SHALL add a note: "Validado contra clausulado"

#### Scenario: Coverage confirmation
- **WHEN** a coverage is listed as "Incluido en amparo básico" without specific details
- **AND** clause PDFs are available
- **THEN** the system SHALL verify the coverage scope in the clause
- **AND** it SHALL extract sub-límites or exclusions not mentioned in the quote
- **AND** it SHALL flag discrepancies between quote and clause

#### Scenario: Exclusion detection
- **WHEN** clause PDFs are processed for validation
- **THEN** the system SHALL identify exclusions mentioned in clauses but not in quotes
- **AND** it SHALL add warnings to the analysis section: "Exclusión no mencionada en cotización: [description]"
- **AND** it SHALL assign severity level based on impact

### Requirement: Deep mode endpoint
The system SHALL expose a separate endpoint for deep clause validation.

#### Scenario: Trigger deep validation
- **WHEN** a client calls `POST /api/comparison/:id/deep-mode`
- **AND** clause files are available
- **THEN** the system SHALL process clause PDFs
- **AND** it SHALL return the enhanced comparison result
- **AND** processing SHALL be async if it takes > 30 seconds

#### Scenario: Deep mode without clauses
- **WHEN** deep mode is requested but no clause files exist
- **THEN** the system SHALL return HTTP 400
- **AND** the error SHALL be "No clause files available for validation"

## Dependencies
- `clause-storage` for clause PDF retrieval
- `unified-comparison-extraction` for base comparison results
