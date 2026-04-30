## ADDED Requirements

### Requirement: Backend test suite passes reliably
The system SHALL resolve path resolution issues in the test environment so that all backend tests execute successfully without file-system errors.

#### Scenario: Vitest runs semantic chunker tests
- **WHEN** the test suite executes in the server directory via Vitest
- **THEN** the `thesaurusService` loads `thesaurus.json` without throwing file-not-found errors
- **AND** all assertions in `semanticChunker.test.ts` pass

### Requirement: Git working tree is clean before commit
The system SHALL ensure that no staged or unstaged changes remain from previous archived changes prior to new commits.

#### Scenario: Pre-commit audit of git state
- **WHEN** a developer reviews the git status before pushing
- **THEN** the working tree shows no unstaged modifications
- **AND** no prior archive moves remain uncommitted

### Requirement: Production code is free of debug logging
The system SHALL remove ad-hoc debug `console.log` statements from backend controllers while preserving essential error handling.

#### Scenario: API controllers handle requests
- **WHEN** the backend processes analysis or RAG requests
- **THEN** no internal progress or debug messages are printed to stdout
- **AND** legitimate error responses still surface to the client
