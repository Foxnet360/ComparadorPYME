# Design: Saneamiento de Integridad, Eliminación de Código Muerto y Unificación Arquitectónica

## Architecture Overview

```
                   Current Fragile Architecture
                   
    [Frontend: UnifiedCoverageMatrix.tsx]
       ├── Has local duplicate transformQuotesToMatrix (hardcoded PYME catIds)
       └── Renders dead components (AuditWizard, VariableMatrix, DeductibleSummary)
       
    [Backend: Dispersed Config & Magic Constants]
       ├── SMMLV: Split between 1300000 (2024) and 1423500 (2025)
       ├── Gemini Models: Defaults scattered across gemini.ts & deepClauseValidator.ts
       ├── Feature Flags: 4 phantom flags with no consumers in code
       └── DeductibleParser: 220 LOC dead service tested but never executed in production

                                 │
                                 ▼
                     Target Clean Architecture
                     
    [Frontend: UnifiedCoverageMatrix.tsx]
       ├── Single source of truth: backend-provided MatrixRow[] (v2)
       ├── Dead components deleted (~850 LOC removed)
       └── Strict fallback handling with empty/loading states
       
    [Backend: Centralized Config & Pruned Core]
       ├── domainConstants.ts / env.ts: Sole authority for SMMLV & UVT
       ├── env.GEMINI_MODEL: Sole authority for LLM model names
       ├── featureFlags.ts: Cleaned of dead/phantom toggles
       └── deductibleParser.ts deleted, using structured flatTableParser exclusively
```

## Technical Decisions

### Decision 1: SMMLV and UVT Consolidation
- Use `process.env.SMMLV_VALUE || '1423500'` and `process.env.UVT_VALUE || '49799'` as central fallbacks in `server/src/config/env.ts`.
- In `domainConstants.ts`, derive SMMLV and UVT dynamically.
- Update test fixtures and expectation helpers to use the configured SMMLV value rather than hardcoded 1.300.000 COP.

### Decision 2: Gemini Model Unification
- In `server/src/services/gemini.ts`, replace all hardcoded fallback strings with `env.GEMINI_MODEL || 'gemini-3.7-flash'`.
- In `deepClauseValidator.ts:227`, replace `'gemini-3.5-flash'` with `process.env.GEMINI_MODEL || 'gemini-3.7-flash'`.
- Update diagnostic scripts to use `gemini-3.7-flash` instead of legacy/deprecated model IDs.

### Decision 3: Removal of Dead Code
- Delete `components/AuditWizard.tsx`, `components/VariableComparisonMatrix.tsx`, and `components/DeductibleSummaryTable.tsx`.
- Delete `server/src/services/deductibleParser.ts` and associated unit tests (`deductibleParser.test.ts`, `deductibleParser.unit.test.ts`).
- Clean unused imports across `server/src/index.ts` and routes.

### Decision 4: Frontend Matrix Simplification
- In `components/UnifiedCoverageMatrix.tsx`, remove `transformQuotesToMatrix`.
- When `rows` is missing or undefined, render an empty state or loading indicator rather than attempting to synthesize legacy rows.

### Decision 5: Feature Flags Cleanup
- Prune `deductibleSemanticParser`, `tripleSourceChat`, `queryExpansion`, and `hybridSearchV2` from `server/src/config/featureFlags.ts`.
