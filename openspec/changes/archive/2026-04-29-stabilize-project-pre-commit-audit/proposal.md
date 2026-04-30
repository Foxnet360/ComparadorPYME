## Why

Before pushing to GitHub and sharing the project state publicly, we need to resolve active instabilities discovered during the recent codebase audit. The backend test suite has 5 failing tests rooted in a path-resolution bug, the git working tree has uncommitted staged changes from the previous change archival, and accumulated debug logging plus an oversized frontend bundle signal declining code quality. This change performs a focused stabilization sprint to restore confidence in the codebase.

## What Changes

- Fix failing backend tests in `semanticChunker` caused by `thesaurusService` loading `thesaurus.json` from a relative path that does not resolve in the Vitest environment.
- Clean up git working tree by committing or reverting the staged archive moves and README modifications left after the last change archival.
- Remove debug `console.log` statements from backend controllers (`analysisController.ts`, `ragClauseController.ts`, etc.).
- Perform a lightweight code-quality review: identify hardcoded credentials, unused imports, and mixed responsibilities in `App.tsx`.
- Evaluate and document opportunities for frontend bundle reduction (currently ~1.25 MB main chunk).

## Capabilities

### New Capabilities
*No new product capabilities are being introduced. This is a stabilization and technical-debt cleanup change.*

### Modified Capabilities
*No existing capability requirements are changing. Only implementation-level fixes and cleanups are in scope.*

## Impact

- **Backend tests**: `server/src/services/__tests__/semanticChunker.test.ts` and related test infrastructure.
- **Git repository**: Working tree state, staged files in `openspec/changes/archive/` and `README.md`.
- **Backend runtime**: `server/src/controllers/analysisController.ts`, `server/src/controllers/ragClauseController.ts`, `server/src/index.ts`.
- **Frontend build**: `App.tsx`, potential `vite.config.ts` adjustments for chunking.
- **No API or behavioral breaking changes.**
