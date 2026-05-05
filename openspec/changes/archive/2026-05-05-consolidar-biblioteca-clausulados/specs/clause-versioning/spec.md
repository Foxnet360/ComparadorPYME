## ADDED Requirements

### Requirement: Auto-archive previous version on new upload
The system SHALL automatically archive the previous active version of a clause document when a new version is uploaded for the same insurer and document type.

#### Scenario: Upload new version replaces old one
- **WHEN** a user uploads a new clause document for insurer "AXA" with type "CLAUSULADO_GENERAL"
- **AND** an active document already exists for "AXA" with type "CLAUSULADO_GENERAL"
- **THEN** the system SHALL set is_active = false on the existing document
- **AND** set is_active = true on the newly uploaded document
- **AND** return success with both document IDs

#### Scenario: First upload for insurer has no archive target
- **WHEN** a user uploads a clause document for insurer "AXA" with type "CLAUSULADO_GENERAL"
- **AND** no active document exists for that insurer and type
- **THEN** the system SHALL set is_active = true on the new document
- **AND** not attempt to archive any previous version

### Requirement: Track version history
The system SHALL maintain a complete version history for each insurer's clause documents.

#### Scenario: View version history
- **WHEN** a user requests version history for insurer "AXA"
- **THEN** the system SHALL return all documents for that insurer ordered by created_at descending
- **AND** include version, document_name, is_active, created_at for each

#### Scenario: Historical versions remain searchable
- **WHEN** a version is archived (is_active = false)
- **THEN** its chunks and embeddings SHALL remain in the database
- **AND** it SHALL be excluded from default searches unless explicitly requested

### Requirement: Support manual version activation
The system SHALL allow administrators to manually activate a previously archived version.

#### Scenario: Reactivate old version
- **WHEN** an admin requests to activate version "2023.1" of a document
- **THEN** the system SHALL archive the currently active version
- **AND** activate the requested version
- **AND** update is_active flags atomically
