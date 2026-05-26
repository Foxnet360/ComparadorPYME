## ADDED Requirements

### Requirement: Request Body Validation
The system SHALL validate all incoming request bodies against Zod schemas before processing.

#### Scenario: Valid request body
- **WHEN** a POST request to `/api/analysis/validate-coverages` has a valid body
- **THEN** the system SHALL process the request normally

#### Scenario: Missing required field
- **WHEN** a request body is missing a required field (e.g., `quote`)
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL specify which field is missing
- **AND** the response format SHALL be `{success: false, error: "Validation failed", details: [{field: "quote", message: "Required"}]}`

#### Scenario: Invalid field type
- **WHEN** a request body has a field with wrong type (e.g., `limit: "abc"` instead of number)
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL specify the expected type

#### Scenario: Extra fields
- **WHEN** a request body contains fields not defined in the schema
- **THEN** the system SHALL strip extra fields
- **AND** process the request with only valid fields

### Requirement: Query Parameter Validation
The system SHALL validate query parameters for type, range, and format.

#### Scenario: Invalid pagination
- **WHEN** a request has `limit=999999999`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "limit must be at most 100"

#### Scenario: Negative offset
- **WHEN** a request has `offset=-1`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "offset must be non-negative"

#### Scenario: Invalid date format
- **WHEN** a request has `startDate="not-a-date"`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "startDate must be a valid ISO 8601 date"

### Requirement: File Upload Validation
The system SHALL validate uploaded files for type, size, and integrity.

#### Scenario: Non-PDF file
- **WHEN** a client uploads a file with MIME type `image/jpeg`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "Only PDF files are allowed"

#### Scenario: File too large
- **WHEN** a client uploads a PDF larger than 50MB
- **THEN** the system SHALL respond with HTTP 413
- **AND** the error SHALL be "File too large. Maximum size is 50MB"

#### Scenario: Corrupted PDF
- **WHEN** a client uploads a file with `.pdf` extension but invalid PDF magic number
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "Invalid PDF file"

### Requirement: User ID Validation
The system SHALL validate that user IDs from JWT tokens match requested resources.

#### Scenario: Access own resources
- **WHEN** user "user-123" requests `/api/history`
- **THEN** the system SHALL return only history entries for "user-123"

#### Scenario: Access another user's resources
- **WHEN** user "user-123" requests `/api/history?userId=user-456`
- **THEN** the system SHALL respond with HTTP 403
- **AND** the error SHALL be "Access denied"

---

## Delta from change: complete-system-audit-remediation

## ADDED Requirements

### Requirement: Request Body Validation
The system SHALL validate all incoming request bodies against Zod schemas before processing.

#### Scenario: Valid request body
- **WHEN** a POST request to `/api/analysis/validate-coverages` has a valid body
- **THEN** the system SHALL process the request normally

#### Scenario: Missing required field
- **WHEN** a request body is missing a required field (e.g., `quote`)
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL specify which field is missing
- **AND** the response format SHALL be `{success: false, error: "Validation failed", details: [{field: "quote", message: "Required"}]}`

#### Scenario: Invalid field type
- **WHEN** a request body has a field with wrong type (e.g., `limit: "abc"` instead of number)
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL specify the expected type

#### Scenario: Extra fields
- **WHEN** a request body contains fields not defined in the schema
- **THEN** the system SHALL strip extra fields
- **AND** process the request with only valid fields

### Requirement: Query Parameter Validation
The system SHALL validate query parameters for type, range, and format.

#### Scenario: Invalid pagination
- **WHEN** a request has `limit=999999999`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "limit must be at most 100"

#### Scenario: Negative offset
- **WHEN** a request has `offset=-1`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "offset must be non-negative"

#### Scenario: Invalid date format
- **WHEN** a request has `startDate="not-a-date"`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "startDate must be a valid ISO 8601 date"

### Requirement: File Upload Validation
The system SHALL validate uploaded files for type, size, and integrity.

#### Scenario: Non-PDF file
- **WHEN** a client uploads a file with MIME type `image/jpeg`
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "Only PDF files are allowed"

#### Scenario: File too large
- **WHEN** a client uploads a PDF larger than 50MB
- **THEN** the system SHALL respond with HTTP 413
- **AND** the error SHALL be "File too large. Maximum size is 50MB"

#### Scenario: Corrupted PDF
- **WHEN** a client uploads a file with `.pdf` extension but invalid PDF magic number
- **THEN** the system SHALL respond with HTTP 400
- **AND** the error SHALL be "Invalid PDF file"

### Requirement: User ID Validation
The system SHALL validate that user IDs from JWT tokens match requested resources.

#### Scenario: Access own resources
- **WHEN** user "user-123" requests `/api/history`
- **THEN** the system SHALL return only history entries for "user-123"

#### Scenario: Access another user's resources
- **WHEN** user "user-123" requests `/api/history?userId=user-456`
- **THEN** the system SHALL respond with HTTP 403
- **AND** the error SHALL be "Access denied"
