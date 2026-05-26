## ADDED Requirements

### Requirement: Global Rate Limiting
The system SHALL limit API requests to prevent abuse and protect expensive AI endpoints.

#### Scenario: General endpoint limit
- **WHEN** a client makes more than 100 requests per 15 minutes to general API endpoints
- **THEN** subsequent requests SHALL receive HTTP 429
- **AND** the response SHALL include `Retry-After` header
- **AND** the error message SHALL be "Rate limit exceeded. Try again in X minutes."

#### Scenario: AI endpoint strict limit
- **WHEN** a client makes more than 10 requests per minute to `/api/analyze`
- **THEN** subsequent requests SHALL receive HTTP 429
- **AND** the response SHALL include `Retry-After` header

#### Scenario: Chat endpoint limit
- **WHEN** a client makes more than 20 requests per minute to `/api/chat`
- **THEN** subsequent requests SHALL receive HTTP 429

#### Scenario: Rate limit headers
- **WHEN** a request is within rate limits
- **THEN** the response SHALL include `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers

### Requirement: Distributed Rate Limiting
The system SHALL use Redis for rate limit storage to ensure limits work across multiple server instances.

#### Scenario: Multi-instance deployment
- **WHEN** the application runs on 3 Railway instances
- **AND** a client makes 50 requests to instance A
- **AND** then makes 60 requests to instance B
- **THEN** the 101st request SHALL be rate limited
- **AND** all instances SHALL share the same rate limit counter

#### Scenario: Redis unavailable fallback
- **WHEN** Redis is not available
- **THEN** the system SHALL fall back to in-memory rate limiting
- **AND** log a warning: "Redis unavailable, using in-memory rate limiting"

### Requirement: Rate Limit Exemptions
The system SHALL support exempting specific routes or users from rate limiting.

#### Scenario: Health check exemption
- **WHEN** a request is made to `/health`
- **THEN** it SHALL NOT count against rate limits

#### Scenario: Admin exemption
- **WHEN** a request includes a valid admin API key
- **THEN** it SHALL bypass rate limiting
