## Why

The current document indexing pipeline faces critical scalability and reliability issues that prevent safe concurrent processing. A recent audit revealed memory leaks in PDF.js usage (missing `destroy()` calls), monolithic synchronous processing that blocks the Node.js event loop, missing database transactions leading to orphaned data on failure, and highly inefficient API batching (N+1 queries and tiny batch sizes for embeddings/DB inserts). Addressing these now is essential before the system scales to more users or larger documents.

## What Changes

- Add strict resource cleanup (`pdfDoc.destroy()`) and `finally` blocks for all temporary files and memory-heavy operations in the PDF extraction phase.
- Wrap the entire document storage process (document record, page images, chunks) in an atomic Supabase database transaction (via RPC) to ensure data integrity.
- Increase the Gemini embeddings batch size to significantly reduce API latency and HTTP overhead.
- Increase the Supabase chunk insert batch size to improve database throughput.
- Refactor `vectorStore.listDocuments` to eliminate N+1 queries by using a single aggregated SQL query.

## Capabilities

### New Capabilities
*No new product capabilities are being introduced. This is a technical refactor to improve scalability and reliability of existing flows.*

### Modified Capabilities
*No existing capability requirements are changing at the spec level. The API contracts and external behavior remain identical.*

## Impact

- **Backend Services**: `pdfExtractor.ts`, `semanticChunker.ts`, `embeddingService.ts`, `documentIndexingService.ts`, `vectorStore.ts`.
- **Database**: A new RPC function will be added via Supabase migrations or SQL snippet for atomic document insertion.
- **Performance**: Significant reduction in memory footprint during PDF parsing, elimination of event-loop stalls, and faster embedding/insertion times.
- **Reliability**: No orphaned chunks or images if an upload fails midway.
