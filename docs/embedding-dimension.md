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
- Automated tests in `tests/server/migrations/migrationSync.test.ts` verify migration idempotency and column definitions.
