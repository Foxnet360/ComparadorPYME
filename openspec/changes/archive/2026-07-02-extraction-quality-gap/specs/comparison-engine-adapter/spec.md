# Delta for comparison-engine-adapter

## MODIFIED Requirements

### Requirement: Feature flag control

The system SHALL default `USE_UNIFIED_ENGINE` to `true` and SHALL NOT apply any hardcoded override that disables the unified engine.

(Previously: the flag defaulted to `false` and a hardcoded override forced the legacy path.)

#### Scenario: Default routing

- GIVEN the server starts with `USE_UNIFIED_ENGINE` unset
- WHEN a comparison request arrives
- THEN the adapter SHALL route to the unified engine
- AND it SHALL log `routing=unified, source=default`

#### Scenario: Explicit disable

- GIVEN `USE_UNIFIED_ENGINE=false`
- WHEN a comparison request arrives
- THEN the adapter SHALL route to the legacy engine
- AND it SHALL log `routing=legacy, source=flag`

#### Scenario: Runtime toggle

- GIVEN the flag value changes between requests without server restart
- WHEN the next comparison request arrives
- THEN the adapter SHALL use the current value
- AND it SHALL NOT cache the flag decision across requests

### Requirement: Legacy fallback

The system SHALL automatically fallback to the legacy per-quote engine when the unified engine fails, and SHALL record the fallback event with a reason.

(Previously: fallback existed but did not require a logged reason or explicit fallback metric.)

#### Scenario: Unified engine failure

- GIVEN the unified engine throws an error
- WHEN the adapter catches it
- THEN it SHALL log the error with correlation ID and reason `unified_error`
- AND it SHALL route to the legacy engine
- AND it SHALL mark the result as fallback in metrics

#### Scenario: Invalid unified result

- GIVEN the unified engine returns a result that fails validation or parsing
- WHEN the adapter validates it
- THEN it SHALL reject the invalid result
- AND it SHALL log the failure reason
- AND it SHALL route to the legacy engine
- AND it SHALL mark the result as fallback in metrics
