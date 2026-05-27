# Spec: Deep Clause Validation

## Capability
Validación de deducibles y coberturas ambiguas contra clausulados de aseguradoras cuando están disponibles, operando como una segunda pasada opcional sobre el resultado de la comparación unificada.

## ADDED Requirements

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

### Requirement: Deep mode activation
The system SHALL support activating deep mode after the initial comparison is complete.

#### Scenario: Post-comparison deep mode
- **WHEN** a user triggers `POST /api/comparison/:id/deep-mode` with clause PDFs
- **THEN** the system SHALL retrieve the existing comparison result
- **AND** it SHALL process the clause PDFs
- **AND** it SHALL return an enriched comparison with validated data
- **AND** it SHALL NOT reprocess the original quote PDFs

#### Scenario: No clauses available
- **WHEN** deep mode is triggered but no clause files are provided
- **THEN** the system SHALL return a 400 Bad Request with message: "No clause files provided"
- **AND** it SHALL suggest uploading clause PDFs first

### Requirement: Clause comparison scope
The system SHALL limit clause validation to relevant sections only.

#### Scenario: Targeted clause validation
- **WHEN** validating clauses for an insurer
- **THEN** the system SHALL focus on deductible and coverage sections
- **AND** it SHALL ignore general legal boilerplate
- **AND** it SHALL extract page numbers for traceability

## Dependencies
- `unified-comparison-extraction` for initial comparison result
- `gemini-api` for clause PDF processing
