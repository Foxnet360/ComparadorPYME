# Spec: Stabilization

## Capability
Estabilización del proyecto mediante resolución de tests, limpieza de logs de debug, y auditoría de calidad de código.

## User Story
**Como** desarrollador del proyecto
**Quiero** un codebase estable y limpio
**Para** poder hacer deploys con confianza

## Functional Requirements

### FR-1: Backend test suite passes reliably
The system SHALL resolve path resolution issues in the test environment so that all backend tests execute successfully without file-system errors.

#### Scenario: Vitest runs semantic chunker tests
- **WHEN** the test suite executes in the server directory via Vitest
- **THEN** the `thesaurusService` loads `thesaurus.json` without throwing file-not-found errors
- **AND** all assertions in `semanticChunker.test.ts` pass

### FR-2: Git working tree is clean before commit
The system SHALL ensure that no staged or unstaged changes remain from previous archived changes prior to new commits.

#### Scenario: Pre-commit audit of git state
- **WHEN** a developer reviews the git status before pushing
- **THEN** the working tree shows no unstaged modifications
- **AND** no prior archive moves remain uncommitted

### FR-3: Production code is free of debug logging
The system SHALL remove ad-hoc debug `console.log` statements from backend controllers while preserving essential error handling.

#### Scenario: API controllers handle requests
- **WHEN** the backend processes analysis or RAG requests
- **THEN** no internal progress or debug messages are printed to stdout
- **AND** legitimate error responses still surface to the client

## Hallazgos de Auditoría

### Credenciales Hardcoded / Demo Auth
- `components/LoginScreen.tsx:12-13` — Pre-filled login form con `admin@seguros.com` / `admin123`
- `components/LoginScreen.tsx:26` — Error message expone credenciales demo
- `services/storageService.ts:36` — Backend validation fallback usa las mismas credenciales hardcoded

### Oportunidades de Reducción de Bundle
1. **Dynamic import para `jspdf` + `jspdf-autotable`** — Solo se necesitan al exportar PDF (~225 kB gzipped)
2. **Dynamic import para `recharts`** — Solo usado en reportes, puede cargarse lazy
3. **Dynamic import para clause-admin components** — `ClauseAdmin.tsx` solo se renderiza cuando se necesita

## Dependencies
- Vitest para testing
- Git para control de versiones
