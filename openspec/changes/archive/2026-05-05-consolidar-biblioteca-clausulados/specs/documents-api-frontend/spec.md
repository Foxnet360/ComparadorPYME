## ADDED Requirements

### Requirement: Migrate frontend to use persistent documents API
The system SHALL migrate all frontend clause management components to use the persistent `/api/documents` endpoints instead of in-memory `/api/rag/clauses`.

#### Scenario: ClauseAdmin uses persistent API
- **WHEN** ClauseAdmin.tsx loads
- **THEN** it SHALL fetch documents from `GET /api/documents?documentType=CLAUSULADO_GENERAL`
- **AND** display insurer name, document name, version, is_active status, and chunk count
- **AND** allow filtering by insurer and active status

#### Scenario: ClauseSelector uses persistent API
- **WHEN** ClauseSelector.tsx loads in library mode
- **THEN** it SHALL fetch active documents from `GET /api/documents?is_active=true`
- **AND** group them by insurer
- **AND** allow multi-select with checkboxes

#### Scenario: Upload through persistent API
- **WHEN** a user uploads a clause through ClauseAdmin
- **THEN** it SHALL use `POST /api/documents`
- **AND** include metadata: insurerName, documentName, version, documentType
- **AND** show progress during indexing

#### Scenario: Delete through persistent API
- **WHEN** a user deletes a clause through ClauseAdmin
- **THEN** it SHALL use `DELETE /api/documents/:id`
- **AND** confirm before deletion
- **AND** refresh the list after deletion

### Requirement: Remove legacy frontend services
The system SHALL remove frontend service methods that call legacy endpoints.

#### Scenario: Deprecate rag service methods
- **WHEN** the migration is complete
- **THEN** `clauseService.ragGetClauses()` SHALL be removed
- **AND** `clauseService.ragCreateClause()` SHALL be removed
- **AND** `clauseService.ragDeleteClause()` SHALL be removed
- **AND** all components SHALL use `clauseService.getDocuments()`, `createDocument()`, `deleteDocument()` instead

### Requirement: Display version information in UI
The system SHALL display version and status information in the clause management UI.

#### Scenario: Show version in ClauseAdmin
- **WHEN** viewing the clause library table
- **THEN** each row SHALL display the version (e.g., "2024.1")
- **AND** status badge ("Activo" or "Archivado")
- **AND** created date

#### Scenario: Show version in ClauseSelector
- **WHEN** selecting clauses for analysis
- **THEN** each clause option SHALL show insurer, product name, and version
- **AND** indicate if it's the latest version
- **AND** allow viewing older versions via dropdown
