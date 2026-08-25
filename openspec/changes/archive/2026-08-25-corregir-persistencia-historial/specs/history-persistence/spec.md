# Spec: Persistencia Incondicional de Historial

## Requirement: Guardado Obligatorio de Comparaciones en Supabase e IndexedDB
The system MUST save every generated comparison report to both Supabase `analysis_history` and local IndexedDB, regardless of whether the user is logged in via OAuth, demo account, or guest mode.

### Scenario: Performing comparison with demo user or guest session
- **GIVEN** a user running a comparison using demo buttons or guest session
- **WHEN** the analysis completes successfully
- **THEN** the backend MUST insert a row in `analysis_history` with a valid `user_id` or `'anonymous'`
- **AND** the frontend MUST save the entry to IndexedDB via `storageService.saveAnalysis`
- **AND** the report MUST appear in the history list upon completion.
