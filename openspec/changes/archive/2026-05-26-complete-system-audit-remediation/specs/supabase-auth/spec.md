## MODIFIED Requirements

### Requirement: Supabase Auth Integration
The system SHALL integrate Supabase Auth for user authentication. **ADDED**: The system SHALL enforce server-side JWT verification and use the anon key with RLS instead of service_role.

#### Scenario: Server-side JWT verification
- **WHEN** a request includes a Supabase JWT
- **THEN** the server SHALL verify it using Supabase's JWT secret
- **AND** SHALL NOT accept tokens from `req.body.userId`

#### Scenario: RLS enforcement
- **WHEN** the backend queries Supabase
- **THEN** it SHALL use the anon key for client-facing operations
- **AND** RLS policies SHALL enforce row-level access control

#### Scenario: Service role restriction
- **WHEN** admin operations are needed
- **THEN** the service_role key SHALL only be used in admin/migration contexts
- **AND** SHALL NOT be used for regular API endpoints

## ADDED Requirements

### Requirement: User Identity in Requests
The system SHALL extract user identity from JWT tokens.

#### Scenario: Authenticated request
- **WHEN** a valid JWT is present
- **THEN** `req.user` SHALL contain the user's ID and email
- **AND** downstream handlers SHALL use `req.user.id`

#### Scenario: Anonymous request
- **WHEN** no JWT is present
- **AND** the endpoint allows anonymous access
- **THEN** `req.user` SHALL be null
- **AND** the handler SHALL treat it as anonymous
