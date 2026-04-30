## Context

The current document indexing pipeline (`parseo -> procesamiento -> almacenamiento`) works functionally but suffers from several scalability and reliability bottlenecks discovered during an audit:
1. **Memory Leaks**: `pdfjs-dist` loads entire PDFs into memory and leaves internal objects hanging because `pdfDoc.destroy()` is never called.
2. **Missing DB Transactions**: `documentIndexingService.ts` inserts data across `documents`, `page_images`, and `chunks` sequentially. If chunk insertion fails, orphaned documents and images remain in the database.
3. **Inefficient Batching**: Gemini embeddings are generated in tiny batches of 5. Supabase chunks are inserted in batches of 50. `vectorStore.listDocuments` executes an N+1 query pattern (`SELECT count(*) FROM chunks` for every single document).
4. **Temporary File Leaks**: If an error occurs early in `documentController.createDocument`, the uploaded multer file might not be cleaned up if the `finally` block isn't strictly handling all exit paths.

## Goals / Non-Goals

**Goals:**
- Eliminate memory leaks in PDF extraction by ensuring `destroy()` is called on all `pdfjs` instances.
- Ensure 100% database consistency during document indexing using atomic transactions.
- Improve indexing speed by optimizing Gemini embedding batch sizes and Supabase bulk inserts.
- Eliminate N+1 queries in document listing.
- Guarantee cleanup of all temporary uploaded files.

**Non-Goals:**
- Moving PDF parsing to dedicated Worker Threads (this adds architectural complexity; fixing the memory leaks is the priority for this iteration).
- Implementing a full job queue (e.g., BullMQ) for asynchronous processing (will keep the HTTP request synchronous for now but make it much faster and safer).
- Changing the frontend UI or API contracts.

## Decisions

### 1. Database Transactions via Supabase RPC
**Decision:** We will create a Supabase RPC function `index_document_transaction` that takes the document metadata, page images, and chunks as JSON arrays and inserts them all inside a single `BEGIN; ... COMMIT;` block in PostgreSQL.
**Rationale:** The Supabase JavaScript client does not support multi-table client-side transactions. RPCs are the recommended way to achieve atomicity.
**Alternatives Considered:** Implementing a manual rollback mechanism in JS. Rejected because it's brittle (what if the Node process crashes during rollback?).

### 2. PDF.js Memory Management
**Decision:** Wrap the `pdfDoc` lifecycle in a `try/finally` block inside `pdfExtractor.ts` to guarantee `await pdfDoc.destroy()` is called. Also, replace `fs.readFileSync` with `fs.promises.readFile` to free up the event loop slightly during disk I/O.
**Rationale:** PDF.js caches font data and worker states that must be explicitly destroyed to prevent heap growth.

### 3. API Batching Optimization
**Decision:** 
- Increase Gemini embedding batch size from 5 to 50.
- Increase Supabase chunk insert batch size from 50 to 250 (inside the new RPC).
**Rationale:** Reduces network overhead and takes advantage of Gemini's and Supabase's ability to handle larger payloads.

### 4. Eliminate N+1 Queries
**Decision:** Refactor `vectorStore.listDocuments` to use a joined query with an aggregate or a dedicated view/RPC, avoiding a loop of `SELECT count(*)` queries.
**Rationale:** Standard practice for database performance.

## Risks / Trade-offs

- **[Risk] RPC Payload Size** → **Mitigation:** Passing hundreds of chunks with 768-dimensional float arrays to a PostgreSQL RPC might hit payload size limits. If this happens, we will insert the document and images via RPC to get the IDs, and then insert chunks using standard Supabase `insert` in a single large batch, relying on foreign key constraints for cascading deletes if we need to rollback manually.
- **[Risk] Gemini Rate Limits with larger batches** → **Mitigation:** The current retry logic with exponential backoff in `gemini.ts` will remain active to handle `429 Too Many Requests`.

## Migration Plan

1. Create the Supabase RPC function (via SQL snippet to be run in the dashboard).
2. Refactor `pdfExtractor.ts` for memory safety.
3. Refactor `documentController.ts` for guaranteed file cleanup.
4. Refactor `documentIndexingService.ts` to use the new RPC.
5. Update batch sizes in `embeddingService.ts`.
6. Fix the N+1 query in `vectorStore.ts`.
