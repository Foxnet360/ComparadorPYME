## Context

The project recently completed a major feature (`implement-document-indexing-service`) that migrated from ChromaDB to Supabase/pgvector and introduced a full document indexing pipeline. After archiving that change, an audit revealed three stabilization needs before the codebase is safe to commit and share:

1. **Backend tests**: The Vitest suite fails because `thesaurusService.ts` uses `path.join(__dirname, '../data/thesaurus.json')`, which does not resolve correctly when tests run via `vitest` + `ts-node` in `server/src/services/__tests__/`.
2. **Git hygiene**: The working tree has staged archive directory moves and a modified `README.md` left uncommitted after the last archival.
3. **Code quality**: Debug `console.log` statements remain in controllers, the frontend bundle exceeds 1.25 MB without code-splitting, and the audit summary noted hardcoded demo credentials.

## Goals / Non-Goals

**Goals:**
- Make the backend test suite pass cleanly (`npm run test` in `server/`).
- Resolve all staged/uncommitted git changes into a clean working tree.
- Strip non-essential debug logging from backend controllers.
- Document concrete code-quality findings and bundle-reduction recommendations.

**Non-Goals:**
- Refactoring `App.tsx` architecture (only identifying issues).
- Implementing bundle code-splitting (only evaluating options).
- Replacing hardcoded auth with a real auth system (only flagging for future work).
- Adding new features or modifying API behavior.

## Decisions

### 1. Fix test paths by resolving from project root
Instead of relative `../data` paths from `__dirname`, the `thesaurusService` will resolve the data directory relative to the project root using `process.cwd()` or an explicit `DATA_DIR` env variable. This ensures tests, dev server, and production builds all resolve the file consistently.

**Alternative considered:** Mock `fs` in every test. Rejected because it hides real integration behavior and adds maintenance burden.

### 2. Commit the pending archival changes rather than revert
The staged moves represent the correct final state of the OpenSpec archive. Committing them keeps the repository history coherent and completes the archival workflow.

**Alternative considered:** Revert to keep history "cleaner." Rejected because the moves are intentional and losing them would orphan the archived specs.

### 3. Remove debug logs instead of switching to a logger library
Given the stabilization scope, we will delete ad-hoc `console.log`/`console.error` debug lines in controllers. A future change can introduce a structured logger like `pino`.

**Alternative considered:** Introduce `pino` now. Rejected to keep the change minimal and avoid new dependencies.

### 4. Keep bundle evaluation advisory
The frontend build succeeds; the 1.25 MB chunk is a warning, not a failure. We will document the easiest split points (e.g., `jspdf`, `recharts`, clause-admin components) without changing `vite.config.ts` now.

## Risks / Trade-offs

- **[Risk] Root-relative path resolution breaks in containerized deployments** → **Mitigation**: Verify `thesaurus.json` is still found when the server runs from `server/dist/` after `tsc` build. If not, adjust to resolve from `require.main.filename` or `import.meta.url` equivalent.
- **[Risk] Removing logs eliminates useful runtime diagnostics** → **Mitigation**: Preserve `console.error` in catch blocks that surface to the API response; only strip "noisy" progress/debug logs.
- **[Risk] Commit includes unintended diffs in README.md** → **Mitigation**: Review `git diff --staged README.md` before finalizing the commit message.

## Migration Plan

1. Fix `thesaurusService.ts` path resolution and run `npm run test` to confirm green.
2. Review staged diff, write a commit message describing the archival completion.
3. Strip debug logs from `analysisController.ts`, `ragClauseController.ts`, and `index.ts`.
4. Run `npm run build` in the frontend to confirm no regressions.
5. Produce a short `QUALITY_AUDIT.md` section in `tasks.md` summarizing findings.
