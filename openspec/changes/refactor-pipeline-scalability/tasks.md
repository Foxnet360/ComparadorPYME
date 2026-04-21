## 1. Database Migrations

- [x] 1.1 Create SQL snippet for `index_document_transaction` RPC function that accepts document metadata, image records, and chunk records to insert them atomically.
- [x] 1.2 Test and execute the SQL snippet in the Supabase dashboard to create the RPC function.

## 2. Memory & Cleanup Refactor

- [x] 2.1 Refactor `pdfExtractor.ts` to wrap `loadingTask.promise` in a `try/finally` block that strictly calls `await pdfDoc.destroy()`.
- [x] 2.2 Refactor `pdfExtractor.ts` to use `fs.promises.readFile` instead of synchronous `fs.readFileSync` for large buffers.
- [x] 2.3 Refactor `documentController.ts` to ensure `fs.unlinkSync(req.file.path)` is called inside a `finally` block covering all execution branches.

## 3. Batching Optimization

- [x] 3.1 Update `embeddingService.ts` to increase `batchSize` from 5 to 50 in `generateEmbeddingsBatch`.
- [x] 3.2 Update `vectorStore.ts` to implement `listDocuments` with a joined query, eliminating the N+1 `count(*)` loop.

## 4. Pipeline Transaction Integration

- [x] 4.1 Update `documentIndexingService.ts` to collect page images and chunks in memory instead of inserting them piecemeal.
- [x] 4.2 Update `documentIndexingService.ts` to call the new `index_document_transaction` RPC instead of sequential Supabase inserts.
- [x] 4.3 Clean up unused sequential insert methods in `documentIndexingService.ts` if no longer needed.

## 5. Verification

- [x] 5.1 Run the backend test suite (`cd server && npm run test`) and ensure all tests pass.
- [ ] 5.2 Upload a document via the frontend and verify it processes successfully without orphaned data or memory spikes.
