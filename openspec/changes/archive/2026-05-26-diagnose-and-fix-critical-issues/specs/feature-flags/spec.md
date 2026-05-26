## ADDED Requirements

### Requirement: Defensive feature flag defaults
The system SHALL determine default feature flag values based on availability of required dependencies.

#### Scenario: Redis not configured
- **WHEN** the `REDIS_URL` environment variable is not set
- **THEN** the `learningEngine` feature flag SHALL default to `false`
- **AND** a warning SHALL be logged at startup: "Redis not configured, learningEngine disabled"

#### Scenario: Redis configured
- **WHEN** the `REDIS_URL` environment variable is set
- **THEN** the `learningEngine` feature flag SHALL default to `true`
- **AND** the system SHALL verify Redis connectivity on startup

#### Scenario: All features with optional dependencies
- **WHEN** any feature flag requires an optional service (Redis, external API)
- **THEN** the system SHALL check service availability before enabling the feature
- **AND** if the service is unavailable, the feature SHALL be disabled
- **AND** a warning SHALL be logged

### Requirement: Feature flag validation on startup
The system SHALL log all active feature flags during startup for debugging purposes.

#### Scenario: Startup feature flag report
- **WHEN** the server starts
- **THEN** it SHALL log a table or list of all feature flags and their values
- **AND** for any flag that was disabled due to missing dependencies, it SHALL log the reason

#### Scenario: Feature flag override via environment
- **WHEN** a `FEATURE_FLAGS` environment variable is set
- **THEN** it SHALL override the calculated defaults
- **AND** individual `FEATURE_*` environment variables SHALL also be respected
- **AND** the final configuration SHALL be logged

### Requirement: Runtime feature flag status
The system SHALL provide an endpoint to query current feature flag status.

#### Scenario: Query feature flags
- **WHEN** a GET request is made to `/api/features`
- **THEN** it SHALL return the current feature flag configuration
- **AND** it SHALL include which flags are active and their dependency status
