# Embedding Dimension Architecture & Decision Record

## Executive Summary
This document establishes the canonical embedding dimension architecture for the **ComparadorPYME / CSA** platform.

| Property | Value / Standard |
|---|---|
| **Primary Embedding Model** | `gemini-embedding-2` / `text-embedding-004` |
| **Canonical Chunk Vector Dimension** | `vector(3072)` |
| **Legacy / Lightweight Clause Dimension** | `vector(768)` (used in fast-matcher RPCs) |
| **Index Strategy (3072D)** | Exact Cosine Distance Scan (pgvector `ivfflat`/`hnsw` has a 2000-dimension limit) |

## Context & Rationale

1. **Model Output Dimension**: `gemini-embedding-2` (and default `text-embedding-004`) outputs **3072-dimensional** floating-point vectors by default.
2. **Database Alignment**: `server/supabase/migrations/017_align_embeddings_3072.sql` and `026_reconcile_prod_schema.sql` align the primary `chunks.embedding` column to `vector(3072)`.
3. **pgvector Indexing Constraints**:
   - `pgvector` indexes (`ivfflat` and standard `hnsw`) enforce a maximum vector limit of **2000 dimensions**.
   - Attempting `CREATE INDEX ... USING ivfflat` on `vector(3072)` raises a database error.
   - For 3072D embeddings, Supabase and Postgres execute exact distance scans (`<->` / `<=>`), which perform accurately for chunk volumes per document.
4. **Dual Representation**:
   - `chunks.embedding`: `vector(3072)` for rich semantic graph and unified comparison RAG retrieval.
   - `clauses.embedding`: `vector(768)` for fast legacy clause matching.

## Verification & Maintenance
- Migration `017` converts `chunks.embedding` to `vector(3072)` without failing on index limits.
- Automated tests in `tests/server/migrations/migrationSync.test.ts` verify migration idempotency, column definitions, and parity between `server/supabase/migrations/` and `supabase/migrations/`.

## Scalability Roadmap (PGVector > 100k Chunks)
When chunk volume grows beyond exact-scan latency budgets:
1. **Preferred (`pgvector >= 0.7.0`)**: Create an expression HNSW index over `halfvec(3072)` (which supports up to 4,000 dimensions):
   `CREATE INDEX CONCURRENTLY idx_chunks_embedding_halfvec_hnsw ON public.chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);`
2. **Alternative (Matryoshka / MRL 1536D)**: Request `outputDimensionality: 1536` from `gemini-embedding-2` and index `vector(1536)` directly with standard HNSW.
3. **Relational Pre-Filtering**: Always scope vector RPCs by `document_id` / `insurer_id` B-tree predicates first to bound candidate sets.

## Canonical Migration Source of Truth
- **Authoring Source of Truth**: `server/supabase/migrations/` (`NNN_*.sql`, sequential numbering enforced by `.github/workflows/ci.yml`).
- **Supabase CLI Mirror**: `supabase/migrations/` (`YYYYMMDD000NNN_*.sql`), kept in byte-for-byte parity with `server/supabase/migrations/` for `026+` (verified by `tests/server/migrations/migrationSync.test.ts`).
- **Legacy Snapshot**: `server/supabase-migration-complete.sql` is a historical snapshot and must not be edited for new schema changes.
