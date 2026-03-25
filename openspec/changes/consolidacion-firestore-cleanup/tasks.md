# Tasks: Consolidación Firestore Cleanup

## Phase 1: Preparation & Research

### Task 1.1: Verify Frontend Usage
**File**: Frontend codebase
**Priority**: High
**Blocked by**: None

- [ ] Search frontend for `/api/insurers` endpoint usage
- [ ] Search frontend for `/api/clauses/*` endpoint usage
- [ ] Document which legacy endpoints are actively used
- [ ] Decide: Create replacement endpoints or remove entirely

**Acceptance Criteria**:
- [ ] Clear list of which legacy endpoints must be preserved/migrated
- [ ] Decision documented in comments

---

### Task 1.2: Audit File Imports
**Files**: All TypeScript files in `server/src/`
**Priority**: High
**Blocked by**: None

- [ ] Run `grep -r "firestore" server/src/ --include="*.ts"` to find all Firestore references
- [ ] Run `grep -r "clauseLibrary" server/src/ --include="*.ts"` to find all imports
- [ ] Run `grep -r "clauseController" server/src/ --include="*.ts"` to find all imports
- [ ] Run `grep -r "embeddingService" server/src/ --include="*.ts"` (not vector/ path)
- [ ] Document all files that need import updates

**Acceptance Criteria**:
- [ ] List of all files importing from files to be deleted
- [ ] Plan for each import (update to new service or remove)

---

### Task 1.3: Create Database Migration
**File**: `server/supabase/migrations/005_analysis_history.sql`
**Priority**: High
**Blocked by**: None

Create new table for analysis history:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create analysis_history table
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_created ON analysis_history(user_id, created_at DESC);

-- Add table comment
COMMENT ON TABLE analysis_history IS 'Stores analysis results for user history';
```

**Acceptance Criteria**:
- [ ] Migration file created
- [ ] Migration runs successfully in local Supabase
- [ ] Table structure verified in Supabase dashboard

---

## Phase 2: Migration of analysisController

### Task 2.1: Replace Firestore Save Logic
**File**: `server/src/controllers/analysisController.ts` (lines 108-124)
**Priority**: High
**Blocked by**: Task 1.3

Replace Firestore save with Supabase:

```typescript
// REMOVE:
const { firestoreService } = require('../services/firestore');
await firestoreService.saveAnalysis(userId, clientName, result);

// ADD:
const { supabase } = require('../config/database');
const { data, error } = await supabase
  .from('analysis_history')
  .insert({
    user_id: userId,
    client_name: clientName,
    analysis_data: result
  });
  
if (error) {
  console.error("Failed to save analysis to Supabase:", error);
}
```

**Acceptance Criteria**:
- [ ] Firestore import removed
- [ ] Supabase insert working
- [ ] Error handling preserved (log but don't block response)
- [ ] TypeScript compiles without errors

---

### Task 2.2: Replace Firestore Get History Logic
**File**: `server/src/controllers/analysisController.ts` (lines 157-173)
**Priority**: High
**Blocked by**: Task 1.3

Replace Firestore getHistory with Supabase:

```typescript
// REMOVE:
const { firestoreService } = require('../services/firestore');
const history = await firestoreService.getHistoryByUser(userId);

// ADD:
const { supabase } = require('../config/database');
const { data: history, error } = await supabase
  .from('analysis_history')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

if (error) {
  console.error("Error fetching history from Supabase:", error);
  res.status(500).json({ error: "Failed to fetch history" });
  return;
}

res.json(history || []);
```

**Acceptance Criteria**:
- [ ] Firestore import removed
- [ ] Supabase query working with proper ordering
- [ ] Error handling working
- [ ] Response format matches expected structure

---

### Task 2.3: Test analysisController Changes
**Files**: `server/src/controllers/analysisController.ts`
**Priority**: Medium
**Blocked by**: Task 2.1, Task 2.2

- [ ] Run TypeScript check: `npx tsc --noEmit`
- [ ] Verify no Firestore references remain in file
- [ ] Manual test: POST /api/analyze
- [ ] Manual test: GET /api/history?userId=test

**Acceptance Criteria**:
- [ ] No TypeScript errors
- [ ] Analysis saves to Supabase (verify in dashboard)
- [ ] History retrieves from Supabase

---

## Phase 3: Route Cleanup

### Task 3.1: Remove Legacy Routes
**File**: `server/src/index.ts`
**Priority**: High
**Blocked by**: Task 1.1 (verify frontend usage)

Remove from `server/src/index.ts`:

```typescript
// REMOVE these imports:
import { clauseController } from './controllers/clauseController';

// REMOVE these routes:
app.post('/api/clauses', upload.single('file'), clauseController.createClause);
app.get('/api/clauses', clauseController.getClauses);
app.get('/api/clauses/:id', clauseController.getClauseById);
app.delete('/api/clauses/:id', clauseController.deleteClause);
app.post('/api/clauses/:id/extract', clauseController.reExtractSections);
app.get('/api/insurers', clauseController.getInsurers);
```

**Note**: If `/api/insurers` is used by frontend, migrate it to documentController first.

**Acceptance Criteria**:
- [ ] Legacy routes removed
- [ ] Server starts without errors
- [ ] Remaining routes work correctly

---

### Task 3.2: Consolidate Duplicate Embedding Service Imports
**Files**: All files importing old embeddingService
**Priority**: Medium
**Blocked by**: Task 1.2

Find and update all imports:

```typescript
// FIND AND REPLACE all instances of:
import { embeddingService } from '../services/embeddingService';

// WITH:
import { embeddingService } from '../services/vector/embeddingService';
```

**Files likely affected** (verify with grep from Task 1.2):
- Any test files
- Any service files
- Any controller files

**Acceptance Criteria**:
- [ ] All imports updated to use `vector/embeddingService`
- [ ] No imports from old `services/embeddingService.ts`
- [ ] TypeScript compiles

---

## Phase 4: File Deletion

### Task 4.1: Delete Firestore Service
**File**: `server/src/services/firestore.ts`
**Priority**: High
**Blocked by**: Task 2.1, Task 2.2, Task 2.3

- [ ] Delete `server/src/services/firestore.ts`
- [ ] Verify no other files import from it

**Acceptance Criteria**:
- [ ] File deleted
- [ ] No broken imports
- [ ] Build succeeds

---

### Task 4.2: Delete Clause Library Service
**File**: `server/src/services/clauseLibrary.ts`
**Priority**: High
**Blocked by**: Task 3.1, Task 4.1

- [ ] Delete `server/src/services/clauseLibrary.ts`
- [ ] Verify no other files import from it

**Acceptance Criteria**:
- [ ] File deleted
- [ ] No broken imports
- [ ] Build succeeds

---

### Task 4.3: Delete Clause Controller
**File**: `server/src/controllers/clauseController.ts`
**Priority**: High
**Blocked by**: Task 3.1

- [ ] Delete `server/src/controllers/clauseController.ts`
- [ ] Verify routes removed from index.ts

**Acceptance Criteria**:
- [ ] File deleted
- [ ] No broken imports
- [ ] Server starts

---

### Task 4.4: Delete Duplicate Embedding Service
**File**: `server/src/services/embeddingService.ts` (old, not in vector/)
**Priority**: High
**Blocked by**: Task 3.2

- [ ] Delete `server/src/services/embeddingService.ts`
- [ ] Verify all imports now use `vector/embeddingService`

**Acceptance Criteria**:
- [ ] File deleted
- [ ] No broken imports
- [ ] Build succeeds

---

### Task 4.5: Delete Obsolete Test Scripts
**Files**: 
- `server/src/scripts/test_clause_library.ts`
- `server/src/scripts/test_library_analysis.ts`
- `server/src/scripts/test_section_extraction.ts`
**Priority**: Medium
**Blocked by**: Task 4.2

- [ ] Delete all three test scripts
- [ ] Verify no npm scripts reference them

**Acceptance Criteria**:
- [ ] All files deleted
- [ ] No references in package.json

---

## Phase 5: Dependency Cleanup

### Task 5.1: Remove firebase-admin from package.json
**File**: `server/package.json`
**Priority**: High
**Blocked by**: Task 4.1

- [ ] Remove `"firebase-admin": "^X.X.X"` from dependencies
- [ ] Run `npm install` to update package-lock.json

**Acceptance Criteria**:
- [ ] Dependency removed from package.json
- [ ] package-lock.json updated
- [ ] No references to firebase-admin in codebase

---

### Task 5.2: Update .env.example
**File**: `server/.env.example`
**Priority**: Low
**Blocked by**: None

Remove Firestore-related environment variables:
```
# REMOVE these if present:
GOOGLE_APPLICATION_CREDENTIALS=
FIREBASE_PROJECT_ID=
GCLOUD_PROJECT=
```

**Acceptance Criteria**:
- [ ] Firestore env vars removed
- [ ] File still has all required Supabase vars

---

## Phase 6: Verification

### Task 6.1: TypeScript Compilation
**Command**: `npx tsc --noEmit`
**Priority**: High
**Blocked by**: All previous tasks

- [ ] Run TypeScript compiler
- [ ] Fix any type errors
- [ ] Zero errors expected

**Acceptance Criteria**:
- [ ] `npx tsc --noEmit` exits with code 0

---

### Task 6.2: Build Verification
**Command**: `npm run build`
**Priority**: High
**Blocked by**: Task 6.1

- [ ] Run build command
- [ ] Verify no build errors
- [ ] Check dist/ folder is generated

**Acceptance Criteria**:
- [ ] Build succeeds
- [ ] No warnings about missing modules

---

### Task 6.3: Endpoint Testing
**Priority**: High
**Blocked by**: Task 6.2

Test these endpoints manually:
- [ ] `POST /api/analyze` - Should save to Supabase
- [ ] `GET /api/history?userId=test` - Should return from Supabase
- [ ] `POST /api/documents` - Should work as before
- [ ] `GET /api/documents` - Should work as before
- [ ] `POST /api/search` - Should work as before

**Acceptance Criteria**:
- [ ] All key endpoints respond 200
- [ ] Data persists in Supabase

---

### Task 6.4: Code Quality Check
**Priority**: Medium
**Blocked by**: Task 6.1

- [ ] Run `grep -r "firestore" server/src/ --include="*.ts"` - Should return nothing
- [ ] Run `grep -r "clauseLibrary" server/src/ --include="*.ts"` - Should return nothing
- [ ] Run `grep -r "clauseController" server/src/ --include="*.ts"` - Should return nothing (except possibly archive)
- [ ] Verify no orphaned imports

**Acceptance Criteria**:
- [ ] Zero references to deleted code
- [ ] Clean codebase

---

## Summary

**Files to Delete**: 8 files (~1,000 líneas)
- [ ] server/src/services/firestore.ts
- [ ] server/src/services/clauseLibrary.ts
- [ ] server/src/services/embeddingService.ts (old)
- [ ] server/src/controllers/clauseController.ts
- [ ] server/src/scripts/test_clause_library.ts
- [ ] server/src/scripts/test_library_analysis.ts
- [ ] server/src/scripts/test_section_extraction.ts

**Files to Modify**: 4 files
- [ ] server/supabase/migrations/005_analysis_history.sql (new)
- [ ] server/src/controllers/analysisController.ts
- [ ] server/src/index.ts
- [ ] server/package.json

**Dependencies Removed**: 1
- [ ] firebase-admin

**Success Criteria**:
- [ ] All tasks above completed
- [ ] Zero Firestore references
- [ ] Build succeeds
- [ ] All key endpoints working
