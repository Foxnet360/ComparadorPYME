## ADDED Requirements

### Requirement: JWT-based API Authentication
The system SHALL verify JWT tokens on all protected API endpoints and reject requests without valid authentication.

#### Scenario: Valid JWT token
- **WHEN** a request includes a valid Supabase JWT in the `Authorization: Bearer <token>` header
- **THEN** the system SHALL verify the token signature and expiration
- **AND** extract the user ID from the token payload
- **AND** attach the user object to `req.user` for downstream handlers
- **AND** allow the request to proceed

#### Scenario: Missing JWT token
- **WHEN** a request to a protected endpoint has no `Authorization` header
- **THEN** the system SHALL respond with HTTP 401
- **AND** the error message SHALL be "Authentication required"

#### Scenario: Invalid JWT token
- **WHEN** a request includes an invalid or expired JWT token
- **THEN** the system SHALL respond with HTTP 401
- **AND** the error message SHALL be "Invalid or expired token"

#### Scenario: User ID from token vs body
- **WHEN** a request has a valid JWT with user ID "user-123"
- **AND** the request body contains `userId: "user-456"`
- **THEN** the system SHALL use "user-123" from the JWT
- **AND** SHALL ignore `req.body.userId`
- **AND** SHALL respond with 403 if the user attempts to access another user's resources

### Requirement: Row Level Security Enforcement
The system SHALL use the Supabase anon key with RLS policies instead of the service_role key for client-facing operations.

#### Scenario: Database query with RLS
- **WHEN** the backend queries the `analysis_history` table
- **THEN** it SHALL use the Supabase anon key
- **AND** RLS policies SHALL ensure users can only read their own records
- **AND** the service_role key SHALL only be used for admin/migration scripts

### Requirement: Credential Cleanup
The system SHALL contain no hardcoded API keys, passwords, or secrets in source code.

#### Scenario: Source code scan
- **WHEN** running `grep -r "AIzaSy\|eyJhbGciOiJIUzI1NiIs" server/src/`
- **THEN** no matches SHALL be found in committed source files
- **AND** all credentials SHALL be loaded from environment variables

### Requirement: Environment Variable Validation
The system SHALL validate required environment variables at startup and fail fast if any are missing.

#### Scenario: Missing required variable
- **WHEN** the server starts without `GEMINI_API_KEY`
- **THEN** it SHALL log a clear error: "Missing required environment variable: GEMINI_API_KEY"
- **AND** exit with code 1

#### Scenario: All variables present
- **WHEN** all required variables are set
- **THEN** the server SHALL start normally
- **AND** log "Environment validation passed"

---

## Delta from change: complete-system-audit-remediation

## ADDED Requirements

### Requirement: JWT-based API Authentication
The system SHALL verify JWT tokens on all protected API endpoints and reject requests without valid authentication.

#### Scenario: Valid JWT token
- **WHEN** a request includes a valid Supabase JWT in the `Authorization: Bearer <token>` header
- **THEN** the system SHALL verify the token signature and expiration
- **AND** extract the user ID from the token payload
- **AND** attach the user object to `req.user` for downstream handlers
- **AND** allow the request to proceed

#### Scenario: Missing JWT token
- **WHEN** a request to a protected endpoint has no `Authorization` header
- **THEN** the system SHALL respond with HTTP 401
- **AND** the error message SHALL be "Authentication required"

#### Scenario: Invalid JWT token
- **WHEN** a request includes an invalid or expired JWT token
- **THEN** the system SHALL respond with HTTP 401
- **AND** the error message SHALL be "Invalid or expired token"

#### Scenario: User ID from token vs body
- **WHEN** a request has a valid JWT with user ID "user-123"
- **AND** the request body contains `userId: "user-456"`
- **THEN** the system SHALL use "user-123" from the JWT
- **AND** SHALL ignore `req.body.userId`
- **AND** SHALL respond with 403 if the user attempts to access another user's resources

### Requirement: Row Level Security Enforcement
The system SHALL use the Supabase anon key with RLS policies instead of the service_role key for client-facing operations.

#### Scenario: Database query with RLS
- **WHEN** the backend queries the `analysis_history` table
- **THEN** it SHALL use the Supabase anon key
- **AND** RLS policies SHALL ensure users can only read their own records
- **AND** the service_role key SHALL only be used for admin/migration scripts

### Requirement: Credential Cleanup
The system SHALL contain no hardcoded API keys, passwords, or secrets in source code.

#### Scenario: Source code scan
- **WHEN** running `grep -r "AIzaSy\|eyJhbGciOiJIUzI1NiIs" server/src/`
- **THEN** no matches SHALL be found in committed source files
- **AND** all credentials SHALL be loaded from environment variables

### Requirement: Environment Variable Validation
The system SHALL validate required environment variables at startup and fail fast if any are missing.

#### Scenario: Missing required variable
- **WHEN** the server starts without `GEMINI_API_KEY`
- **THEN** it SHALL log a clear error: "Missing required environment variable: GEMINI_API_KEY"
- **AND** exit with code 1

#### Scenario: All variables present
- **WHEN** all required variables are set
- **THEN** the server SHALL start normally
- **AND** log "Environment validation passed"
