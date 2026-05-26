## ADDED Requirements

### Requirement: Centralized Error Handling
The system SHALL use a centralized error handling middleware to catch and format all errors consistently.

#### Scenario: Operational error
- **WHEN** a validation error occurs
- **THEN** the middleware SHALL catch it
- **AND** respond with the appropriate status code (400, 401, 403, 404, 429)
- **AND** the response SHALL be `{success: false, error: "<message>"}`

#### Scenario: Unknown error
- **WHEN** an unexpected error occurs
- **THEN** the middleware SHALL catch it
- **AND** respond with HTTP 500
- **AND** the response SHALL be `{success: false, error: "Internal server error"}`
- **AND** the original error SHALL be logged with stack trace
- **AND** the original error SHALL NOT be exposed to the client

#### Scenario: Async error
- **WHEN** an async route handler throws an unhandled rejection
- **THEN** the middleware SHALL catch it
- **AND** prevent the process from crashing

### Requirement: Custom Error Classes
The system SHALL use domain-specific error classes instead of generic Error objects.

#### Scenario: Validation error
- **WHEN** input validation fails
- **THEN** a `ValidationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 400` and `details: [{field, message}]`

#### Scenario: Authentication error
- **WHEN** authentication fails
- **THEN** an `AuthenticationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 401`

#### Scenario: Authorization error
- **WHEN** a user accesses another user's resource
- **THEN** an `AuthorizationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 403`

#### Scenario: Rate limit error
- **WHEN** rate limit is exceeded
- **THEN** a `RateLimitError` SHALL be thrown
- **AND** it SHALL include `statusCode: 429` and `retryAfter: <seconds>`

#### Scenario: Not found error
- **WHEN** a requested resource doesn't exist
- **THEN** a `NotFoundError` SHALL be thrown
- **AND** it SHALL include `statusCode: 404`

### Requirement: Structured Logging
The system SHALL use structured logging (Pino) instead of console.log/error.

#### Scenario: Request logging
- **WHEN** a request is received
- **THEN** the system SHALL log: method, path, userId, duration, statusCode
- **AND** the log SHALL be in JSON format

#### Scenario: Error logging
- **WHEN** an error occurs
- **THEN** the system SHALL log: error name, message, stack trace, request context
- **AND** sensitive data SHALL be redacted from logs

#### Scenario: Development vs production
- **WHEN** NODE_ENV is "development"
- **THEN** logs SHALL be pretty-printed
- **WHEN** NODE_ENV is "production"
- **THEN** logs SHALL be JSON format for log aggregation

---

## Delta from change: complete-system-audit-remediation

## ADDED Requirements

### Requirement: Centralized Error Handling
The system SHALL use a centralized error handling middleware to catch and format all errors consistently.

#### Scenario: Operational error
- **WHEN** a validation error occurs
- **THEN** the middleware SHALL catch it
- **AND** respond with the appropriate status code (400, 401, 403, 404, 429)
- **AND** the response SHALL be `{success: false, error: "<message>"}`

#### Scenario: Unknown error
- **WHEN** an unexpected error occurs
- **THEN** the middleware SHALL catch it
- **AND** respond with HTTP 500
- **AND** the response SHALL be `{success: false, error: "Internal server error"}`
- **AND** the original error SHALL be logged with stack trace
- **AND** the original error SHALL NOT be exposed to the client

#### Scenario: Async error
- **WHEN** an async route handler throws an unhandled rejection
- **THEN** the middleware SHALL catch it
- **AND** prevent the process from crashing

### Requirement: Custom Error Classes
The system SHALL use domain-specific error classes instead of generic Error objects.

#### Scenario: Validation error
- **WHEN** input validation fails
- **THEN** a `ValidationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 400` and `details: [{field, message}]`

#### Scenario: Authentication error
- **WHEN** authentication fails
- **THEN** an `AuthenticationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 401`

#### Scenario: Authorization error
- **WHEN** a user accesses another user's resource
- **THEN** an `AuthorizationError` SHALL be thrown
- **AND** it SHALL include `statusCode: 403`

#### Scenario: Rate limit error
- **WHEN** rate limit is exceeded
- **THEN** a `RateLimitError` SHALL be thrown
- **AND** it SHALL include `statusCode: 429` and `retryAfter: <seconds>`

#### Scenario: Not found error
- **WHEN** a requested resource doesn't exist
- **THEN** a `NotFoundError` SHALL be thrown
- **AND** it SHALL include `statusCode: 404`

### Requirement: Structured Logging
The system SHALL use structured logging (Pino) instead of console.log/error.

#### Scenario: Request logging
- **WHEN** a request is received
- **THEN** the system SHALL log: method, path, userId, duration, statusCode
- **AND** the log SHALL be in JSON format

#### Scenario: Error logging
- **WHEN** an error occurs
- **THEN** the system SHALL log: error name, message, stack trace, request context
- **AND** sensitive data SHALL be redacted from logs

#### Scenario: Development vs production
- **WHEN** NODE_ENV is "development"
- **THEN** logs SHALL be pretty-printed
- **WHEN** NODE_ENV is "production"
- **THEN** logs SHALL be JSON format for log aggregation
