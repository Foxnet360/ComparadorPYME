## ADDED Requirements

### Requirement: Interactive CLI for bulk clause seeding
The system SHALL provide an interactive CLI script to bulk-upload and index clause documents from a local directory.

#### Scenario: Scan directory and index clauses interactively
- **WHEN** an administrator runs `npm run seed:clauses`
- **THEN** the system SHALL scan a configured directory for PDF files
- **AND** present each file interactively asking for:
  - insurer name (suggesting extracted name from filename)
  - document/product name
  - version string
  - document type (CLAUSULADO_GENERAL, CLAUSULADO_PARTICULAR, etc.)
- **AND** index each document using the document indexing service
- **AND** show progress with counts (current/total, chunks created)

#### Scenario: Resume interrupted seeding
- **WHEN** a previous seeding operation was interrupted
- **AND** the administrator re-runs the script
- **THEN** the system SHALL detect already-indexed files by file hash
- **AND** skip them unless `--force` flag is provided
- **AND** continue with remaining files

#### Scenario: Seed from manifest file
- **WHEN** a manifest.json file exists in the seed directory
- **AND** the administrator runs `npm run seed:clauses -- --manifest`
- **THEN** the system SHALL read metadata from manifest.json instead of prompting interactively
- **AND** process all files defined in the manifest automatically

### Requirement: Support multiple seed directories
The system SHALL support seeding from multiple directory structures.

#### Scenario: Seed from examples directory
- **WHEN** seeding from `/Ejemplos/` directory structure
- **THEN** the system SHALL traverse subdirectories recursively
- **AND** detect clause PDFs in any subdirectory named "Clausulados" or "CLAUSULADOS"
- **AND** use parent directory name as client identifier (not insurer)

#### Scenario: Seed from organized insurer directories
- **WHEN** seeding from `/server/seed-clauses/` with structure:
  ```
  seed-clauses/
  ├── AXA-COLPATRIA/
  │   └── clausulado-axa-pyme-2024.pdf
  ├── BBVA/
  │   └── clausulado-bbva-empresas-2024.pdf
  ```
- **THEN** the system SHALL use directory name as insurer suggestion
- **AND** use filename as document name suggestion

### Requirement: Validation during seeding
The system SHALL validate documents before indexing during seed operations.

#### Scenario: Reject invalid PDFs
- **WHEN** a scanned PDF has no extractable text
- **THEN** the system SHALL warn and skip it
- **AND** continue with next file
- **AND** report skipped files at end

#### Scenario: Duplicate detection
- **WHEN** a file with identical hash already exists in database
- **THEN** the system SHALL warn about duplicate
- **AND** offer options: skip, replace, or rename
