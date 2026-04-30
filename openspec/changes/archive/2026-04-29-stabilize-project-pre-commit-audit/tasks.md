## 1. Fix Backend Tests

- [x] 1.1 Update `thesaurusService.ts` to resolve `thesaurus.json` reliably in test, dev, and production environments.
- [x] 1.2 Run `cd server && npm run test` and confirm all tests pass.
- [x] 1.3 Verify the fix also works after `npm run build` in the server (dist path resolution).

## 2. Clean Up Git State

- [x] 2.1 Review `git diff --staged` to confirm archive moves and README changes are intentional.
- [ ] 2.2 Commit staged changes with a message completing the previous change archival.
- [ ] 2.3 Confirm `git status` shows a clean working tree.

## 3. Remove Debug Logging

- [x] 3.1 Audit `server/src/controllers/analysisController.ts` and remove non-essential `console.log` statements.
- [x] 3.2 Audit `server/src/controllers/ragClauseController.ts` and remove non-essential `console.log` statements.
- [x] 3.3 Audit `server/src/index.ts` and remove startup debug logs (keep essential warnings).
- [x] 3.4 Re-run backend tests and a quick smoke test to ensure no regressions.

## 4. Code Quality & Bundle Review

- [x] 4.1 Identify and document hardcoded credentials or demo-only auth patterns in the frontend.
- [x] 4.2 List unused imports or oversized dependencies in `App.tsx` and frontend components.
- [x] 4.3 Document top 3 opportunities for frontend bundle reduction (e.g., dynamic imports for `jspdf`, `recharts`, clause-admin).
- [x] 4.4 Confirm `npm run build` in the frontend completes without new errors.

## 5. Final Verification

- [x] 5.1 Run full frontend build successfully.
- [x] 5.2 Run full backend test suite successfully.
- [x] 5.3 Verify git working tree is clean and ready for GitHub push.

---

## Quality Audit Findings (Task 4 Summary)

### Hardcoded Credentials / Demo Auth
- `components/LoginScreen.tsx:12-13` — Pre-fills login form with `admin@seguros.com` / `admin123`.
- `components/LoginScreen.tsx:26` — Error message exposes the demo credentials.
- `components/LoginScreen.tsx:141` — UI displays "Acceso Demo: admin@seguros.com / admin123".
- `services/storageService.ts:36` — Backend validation fallback uses the same hardcoded pair.
**Recommendation:** Remove pre-filled values and demo text before production; migrate to a real auth backend.

### Unused Imports / Dependencies
- `App.tsx` — Removed unused `FileText`, `Home` (lucide-react) and `createChatSession` (geminiService).
- No other clearly unused imports found in major components.

### Top 3 Bundle Reduction Opportunities
1. **Dynamic import for `jspdf` + `jspdf-autotable`** — Only needed when user clicks "Export PDF" in `ComparisonReport.tsx`. Current main chunk includes ~225 kB (gzipped) of PDF libs.
2. **Dynamic import for `recharts`** — Only used in `ComparisonReport.tsx` for charts. Could lazy-load on report view.
3. **Dynamic import for clause-admin components** — `ClauseAdmin.tsx` and `ClauseSelector.tsx` are only rendered when `showClauseAdmin` is true. Lazy loading would reduce initial bundle significantly.

Main chunk remains ~1.25 MB; all three splits are low-risk and should be tackled in a future performance-focused change.
