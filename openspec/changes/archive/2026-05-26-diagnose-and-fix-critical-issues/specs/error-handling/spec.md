## MODIFIED Requirements

### Requirement: Centralized Error Handling
The system SHALL use a centralized error handling middleware to catch and format all errors consistently, including domain-specific errors from external services.

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

#### Scenario: Gemini rate limit error
- **WHEN** a Gemini API call returns a 429 status
- **THEN** a `GeminiRateLimitError` SHALL be thrown
- **AND** it SHALL include `statusCode: 429` and `retryAfter: <seconds>`
- **AND** the error response SHALL include user-friendly message "Límite de requests excedido. Espera 1 minuto y reintenta."

#### Scenario: Gemini service unavailable
- **WHEN** a Gemini API call returns a 503 status
- **THEN** a `GeminiServiceUnavailableError` SHALL be thrown
- **AND** it SHALL include `statusCode: 503`
- **AND** the error response SHALL include user-friendly message "Gemini temporalmente no disponible. Reintenta en unos momentos."

#### Scenario: Gemini timeout error
- **WHEN** a Gemini API call exceeds the timeout threshold
- **THEN** a `GeminiTimeoutError` SHALL be thrown
- **AND** it SHALL include `statusCode: 504`
- **AND** the error response SHALL include user-friendly message "La extracción tomó demasiado tiempo. Intenta con un PDF más pequeño."

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

#### Scenario: Gemini errors
- **WHEN** a Gemini API error occurs
- **THEN** the appropriate `GeminiError` subclass SHALL be thrown
- **AND** it SHALL include `statusCode`, `errorCode`, and `userMessage`

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

## ADDED Requirements

### Requirement: Request ID Tracking
The system SHALL generate a unique request ID for each incoming request and include it in all logs and error responses.

#### Scenario: Request ID generation
- **WHEN** a request is received
- **THEN** the system SHALL generate a UUID v4 request ID
- **AND** it SHALL be stored in the request context

#### Scenario: Request ID in logs
- **WHEN** any log is written during request processing
- **THEN** the log entry SHALL include the request ID

#### Scenario: Request ID in error responses
- **WHEN** an error response is sent
- **THEN** it SHALL include the request ID in the response body
- **AND** it SHALL include the request ID in the `X-Request-ID` header

### Requirement: User-Facing Error Messages
The system SHALL provide clear, actionable error messages for external service failures.

#### Scenario: Gemini error messages
- **WHEN** a Gemini error occurs
- **THEN** the error response SHALL include:
  - `code`: Machine-readable error code (e.g., `GEMINI_RATE_LIMIT`)
  - `message`: Human-readable message in Spanish
  - `requestId`: The request ID for support reference

#### Scenario: Frontend error display
- **WHEN** the frontend receives an error response
- **THEN** it SHALL display the user-friendly message
- **AND** it SHALL show the request ID for support contact
