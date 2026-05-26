## ADDED Requirements

### Requirement: Dead Code Removal
The system SHALL remove unused code, files, and dependencies.

#### Scenario: Unused state removal
- **WHEN** `App.tsx` is reviewed
- **THEN** the `progress` state and empty `useEffect` SHALL be removed

#### Scenario: Debug file archival
- **WHEN** debug files are reviewed
- **THEN** `debug-confidence.ts`, `debug-coverage-match.ts`, `debug-bbva.ts` SHALL be moved to `scripts/debug/` or removed

#### Scenario: Orphaned script removal
- **WHEN** scripts in `/server/` are reviewed
- **THEN** files never imported (`test-server.js`, `test-rag-retrieval.ts`, etc.) SHALL be removed or moved to `scripts/`

### Requirement: Utility Consolidation
The system SHALL eliminate duplicate utility functions.

#### Scenario: Text utilities
- **WHEN** `utils/textUtils.ts` and `server/src/utils/textUtils.ts` are compared
- **THEN** they SHALL be consolidated into a single canonical location
- **AND** all imports SHALL be updated

#### Scenario: String utilities
- **WHEN** `utils/stringUtils.ts` and `server/src/utils/stringUtils.ts` are compared
- **THEN** they SHALL be consolidated

#### Scenario: Currency formatting
- **WHEN** `utils/formatCurrency.ts` and `server/src/utils/formatCurrency.ts` are compared
- **THEN** they SHALL be consolidated

### Requirement: Type Safety Improvement
The system SHALL reduce the use of `any` types and improve TypeScript coverage.

#### Scenario: Database query typing
- **WHEN** Supabase queries are reviewed
- **THEN** `as any` casts SHALL be removed
- **AND** proper `Database` types SHALL be used

#### Scenario: Service return types
- **WHEN** service functions are reviewed
- **THEN** they SHALL have explicit return types
- **AND** `Promise<any>` SHALL be replaced with specific types

### Requirement: Duplicate Type Fix
The system SHALL fix the duplicate `QuoteAnalysis` interface.

#### Scenario: Type definition review
- **WHEN** `types.ts` is reviewed
- **THEN** the duplicate `QuoteAnalysis` definition SHALL be removed
- **AND** a single canonical definition SHALL be used

### Requirement: Pre-commit Hooks
The system SHALL enforce code quality via pre-commit hooks.

#### Scenario: Commit attempt with issues
- **WHEN** a developer commits code with TypeScript errors
- **THEN** the commit SHALL be blocked
- **AND** the errors SHALL be displayed

#### Scenario: Commit attempt with secrets
- **WHEN** a developer attempts to commit a file with potential secrets
- **THEN** the commit SHALL be blocked
- **AND** a warning SHALL be displayed
