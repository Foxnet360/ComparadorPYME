## 1. Backend - Consolidate Document Controller

- [x] 1.1 Modify `documentController.createDocument` to implement auto-archive logic (archive previous active version for same insurer+type+product)
- [x] 1.2 Add `latest` query parameter to `documentController.listDocuments` to return only latest active version per insurer+product+type
- [x] 1.3 Add `product_name` field support to document upload validation and processing
- [x] 1.4 Add database indexes for `is_active` + `insurer_id` queries
- [x] 1.5 Test document upload with auto-archive using 3 test insurers

## 2. Backend - Create CLI Seed Script

- [x] 2.1 Create `server/src/scripts/seedClauses.ts` with interactive CLI
- [x] 2.2 Implement PDF scanning from `/Ejemplos/` directory structure
- [x] 2.3 Add interactive prompts for insurer name, product name, version, document type
- [x] 2.4 Add manifest.json support for batch mode (`--manifest` flag)
- [x] 2.5 Add duplicate detection by file hash
- [x] 2.6 Add resume capability (`--resume` flag) to skip already indexed files
- [x] 2.7 Test seed script with 7 example clauses from `/Ejemplos/`
- [x] 2.8 Add npm script `seed:clauses` to package.json

## 3. Frontend - Update Clause Service

- [x] 3.1 Add `getDocuments()` method calling `GET /api/documents`
- [x] 3.2 Add `createDocument()` method calling `POST /api/documents`
- [x] 3.3 Add `deleteDocument()` method calling `DELETE /api/documents/:id`
- [x] 3.4 Add `getDocumentVersions()` method calling `GET /api/documents?insurerId=X`
- [x] 3.5 Mark legacy methods (`ragGetClauses`, `ragCreateClause`, `ragDeleteClause`) as deprecated with console warnings

## 4. Frontend - Redesign ClauseAdmin Component

- [x] 4.1 Migrate data fetching from `/api/rag/clauses` to `/api/documents`
- [x] 4.2 Add version column to clause library table
- [x] 4.3 Add status badge (Activo/Archivado) with color coding
- [x] 4.4 Add filter by status (Active/Archived/All)
- [x] 4.5 Add "View Versions" button showing historical versions in modal
- [x] 4.6 Update upload form to include version field and product name
- [x] 4.7 Update delete to use `DELETE /api/documents/:id` with confirmation

## 5. Frontend - Redesign ClauseSelector Component

- [x] 5.1 Migrate data fetching to `/api/documents?is_active=true`
- [x] 5.2 Group clauses by insurer with collapsible sections
- [x] 5.3 Show version and document type for each clause option
- [x] 5.4 Allow multi-select of clauses per insurer (checkboxes)
- [x] 5.5 Add "Latest Version" indicator
- [x] 5.6 Maintain backward compatibility with traditional upload mode
- [x] 5.7 Update selection state management to support multiple clauses per insurer

## 6. Testing & Validation

- [x] 6.1 Test auto-archive: Upload new version, verify old version archived
- [x] 6.2 Test multi-clause: Select both General and Particular for same insurer
- [x] 6.3 Test CLI seed: Run `npm run seed:clauses` with 7 example files
- [x] 6.4 Test RAG search: Verify archived clauses excluded from default search
- [x] 6.5 Test frontend: Verify ClauseAdmin shows versions correctly
- [x] 6.6 Test frontend: Verify ClauseSelector allows multi-select
- [x] 6.7 Run full audit workflow end-to-end with pre-loaded clauses

## 7. Cleanup & Deprecation

- [x] 7.1 Add deprecation headers to `/api/rag/*` endpoints
- [x] 7.2 Remove `ragClauseController.ts` (after 1 sprint of deprecation)
- [x] 7.3 Remove `clauseController.ts` (after 1 sprint of deprecation)
- [x] 7.4 Remove legacy methods from `clauseService.ts`
- [x] 7.5 Update API documentation
- [x] 7.6 Create backup branch `backup/legacy-clause-controllers` before deletion

## 8. Documentation

- [x] 8.1 Document new versioned clause library workflow
- [x] 8.2 Create admin guide for uploading new clause versions
- [x] 8.3 Document CLI seed script usage with examples
- [x] 8.4 Update broker user guide with new clause selection UI
- [x] 8.5 Document rollback procedure
