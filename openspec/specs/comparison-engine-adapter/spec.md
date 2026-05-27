# Spec: Comparison Engine Adapter

## Capability
Adaptador que permite la coexistencia segura del motor de comparación unificado con el sistema legacy mediante feature flags, fallback automático y compatibilidad total con la interfaz MatrixRow[] existente.

## Requirements

### Requirement: Feature flag control
The system SHALL use a feature flag to enable/disable the unified comparison engine.

#### Scenario: Flag enabled
- **WHEN** `USE_UNIFIED_ENGINE` environment variable is set to `"true"`
- **THEN** the adapter SHALL route comparison requests to the unified engine
- **AND** it SHALL log the routing decision

#### Scenario: Flag disabled
- **WHEN** `USE_UNIFIED_ENGINE` is unset or set to `"false"`
- **THEN** the adapter SHALL route comparison requests to the legacy engine
- **AND** it SHALL NOT load or initialize the unified engine services

#### Scenario: Runtime flag check
- **WHEN** a comparison request is received
- **THEN** the adapter SHALL check the flag at request time (not at startup)
- **AND** it SHALL support toggling without server restart

### Requirement: Legacy fallback
The system SHALL automatically fallback to the legacy engine if the unified engine fails.

#### Scenario: Unified engine failure
- **WHEN** the unified engine throws an error or returns invalid data
- **THEN** the adapter SHALL catch the error
- **AND** it SHALL log the error with correlation ID
- **AND** it SHALL route to the legacy engine
- **AND** it SHALL mark the result as fallback in metrics

#### Scenario: Invalid unified result
- **WHEN** the unified engine returns a result that fails validation
- **THEN** the adapter SHALL reject the invalid result
- **AND** it SHALL fallback to legacy processing
- **AND** it SHALL log the validation failure reason

### Requirement: MatrixRow compatibility
The system SHALL ensure the unified engine output matches the legacy output format.

#### Scenario: Unified result transformation
- **WHEN** the unified engine returns a `UnifiedComparisonResult`
- **THEN** the adapter SHALL transform it to `MatrixRow[]`
- **AND** the structure SHALL match the legacy format exactly
- **AND** the UI SHALL render it identically

#### Scenario: Excel export compatibility
- **WHEN** the comparison result is exported to Excel
- **THEN** the unified engine result SHALL generate the same Excel format
- **AND** all columns SHALL match the legacy output
- **AND** formatting SHALL be identical

## Dependencies
- `unified-comparison-extraction` for unified engine processing
- `quote-analysis-v2` for legacy fallback
