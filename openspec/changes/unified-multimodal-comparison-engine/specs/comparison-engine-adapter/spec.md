# Spec: Comparison Engine Adapter

## Capability
Adaptador que permite la coexistencia segura del motor de comparación unificado con el sistema legacy mediante feature flags, fallback automático y compatibilidad total con la interfaz MatrixRow[] existente.

## ADDED Requirements

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
- **AND** it SHALL log the failure with context
- **AND** it SHALL automatically call the legacy engine
- **AND** it SHALL add a warning: "Comparación generada con motor legacy debido a error"

#### Scenario: Legacy also fails
- **WHEN** both unified and legacy engines fail
- **THEN** the adapter SHALL throw a comprehensive error
- **AND** it SHALL include error details from both engines for debugging

### Requirement: MatrixRow compatibility
The system SHALL ensure the unified engine output is fully compatible with the existing MatrixRow[] interface.

#### Scenario: Adapter transformation
- **WHEN** the unified engine returns a `UnifiedComparisonResult`
- **THEN** the adapter SHALL transform it to `MatrixRow[]` format
- **AND** all fields SHALL be populated: type, id, label, sectionId, cells
- **AND** cell values SHALL match the structure expected by UnifiedCoverageMatrix.tsx

#### Scenario: Excel export parity
- **WHEN** MatrixRow[] is generated from unified engine via adapter
- **AND** it is passed to excelGenerator.ts
- **THEN** the generated Excel SHALL match the structure of the reference Excel
- **AND** it SHALL contain all 3 worksheets: Portada, Coberturas y Deducibles, Primas y Costos

### Requirement: Gradual rollout support
The system SHALL support gradual activation of the unified engine by user segments.

#### Scenario: Percentage-based rollout
- **WHEN** `USE_UNIFIED_ENGINE_ROLLOUT` is set to a percentage (e.g., "10")
- **THEN** the adapter SHALL enable unified engine for that percentage of requests
- **AND** it SHALL use a deterministic hash of the user ID for consistency

#### Scenario: User-specific override
- **WHEN** a user has a `force_unified_engine` flag in their profile
- **THEN** the adapter SHALL always use unified engine for that user
- **AND** it SHALL bypass the percentage-based rollout

## Dependencies
- `unified-comparison-extraction` for the new engine
- `quote-analysis-v2` for the legacy engine fallback
