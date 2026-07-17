# Delta for feature-flags

## ADDED Requirements

### Requirement: New unified graph and template flags

The system SHALL expose `useUnifiedGraphCanonicalization`, `useUnifiedTemplateHints`, and per-insurer flags `useUnifiedTemplateHintsBbva`, `useUnifiedTemplateHintsSbs`, and `useUnifiedTemplateHintsMapfre` in `FeatureFlags`, defaulting to `false` in `DEFAULT_FEATURE_FLAGS` and `PRODUCTION_ROLLOUT_FLAGS`.

#### Scenario: Flags visible in status endpoint

- GIVEN the server starts with no overrides
- WHEN a GET request is made to `/api/features`
- THEN the response SHALL include `useUnifiedGraphCanonicalization: false`, `useUnifiedTemplateHints: false`, and the three per-insurer flags.

#### Scenario: Environment overrides boolean values

- GIVEN `USE_UNIFIED_GRAPH_CANONICALIZATION=true` and `USE_UNIFIED_TEMPLATE_HINTS=true` are set
- WHEN `FeatureFlagManager` loads
- THEN the corresponding flags SHALL be `true`.

### Requirement: Percentage rollout without deploy

Each new flag SHALL support a 0-100 rollout percentage via environment variables (`USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT`, `USE_UNIFIED_TEMPLATE_HINTS_ROLLOUT`, `USE_UNIFIED_TEMPLATE_HINTS_BBVA_ROLLOUT`, etc.) parsed at request time so changes take effect without redeploy.

#### Scenario: Rollout set to 25%

- GIVEN `USE_UNIFIED_TEMPLATE_HINTS_ROLLOUT=25`
- WHEN a request from a non-exempt user arrives
- THEN only users whose hash falls in the first 25% SHALL receive template hints.

#### Scenario: Rollout set to 100%

- GIVEN `USE_UNIFIED_GRAPH_CANONICALIZATION_ROLLOUT=100`
- WHEN any request arrives
- THEN graph canonicalization SHALL be enabled for that request.

### Requirement: Cost and latency disable trigger

The system SHALL measure per-insurer token count and latency for template-hint requests and set the corresponding per-insurer flag to `false` when the p95 increase exceeds 15% over the baseline measured without hints.

#### Scenario: Token increase exceeds 15%

- GIVEN `useUnifiedTemplateHintsBbva` is enabled and baseline token cost is 1000 tokens
- WHEN p95 measured cost exceeds 1150 tokens
- THEN the system SHALL disable `useUnifiedTemplateHintsBbva` for subsequent requests
- AND it SHALL log `template_hints_disabled=bbva, reason=token_increase`.

#### Scenario: Latency increase exceeds 15%

- GIVEN baseline p95 latency without hints is 8000ms
- WHEN p95 latency with hints exceeds 9200ms
- THEN the system SHALL disable the affected per-insurer flag
- AND it SHALL log `template_hints_disabled=<insurer>, reason=latency_increase`.
