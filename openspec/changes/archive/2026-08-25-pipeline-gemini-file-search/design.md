# Design: Dual-Track Gemini API Model Pipeline & File Search Store

## Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
                       │           DOCUMENTOS ENTRANTES          │
                       └────────────────────┬────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
     Cotizaciones (2 - 15 págs)                      Clausulados (100+ págs)
     ┌────────────────────────┐                      ┌────────────────────────┐
     │ Ingesta Directa        │                      │ Gemini File Search     │
     │ Zero-Chunking          │                      │ RAG Nativo (Store)     │
     │ Model: gemini-3.7-flash│                      │ Embeddings:            │
     │ Thinking: HIGH         │                      │ gemini-embedding-2     │
     └───────────┬────────────┘                      └───────────┬────────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                        ┌─────────────────────────────────┐
                        │ COMPARACIÓN FINAL CON CITAS     │
                        │ DE PÁGINA Y DEDUCIBLES EXACTOS  │
                        └─────────────────────────────────┘
```

## Key Architectural Decisions

1. **Dual-Track Document Handling:**
   - **Quotes (2-15 pages):** Sent in full directly to `gemini-3.7-flash` via vision/text zero-chunking. Reasoning level set to `high`.
   - **Clauses/Manuals (100+ pages):** Managed via native `fileSearchStore` in Gemini API, indexed with `gemini-embedding-2`. Query time retrieval retrieves relevant chunks with exact `page_number` annotations.

2. **Model Assignment by Specialty:**
   - `GEMINI_MODEL`: `gemini-3.7-flash` (Primary matrix comparison & deep quote extraction).
   - `GEMINI_THINKING_LEVEL`: `high` (Forces multi-step reasoning for deductible tables).
   - `GEMINI_CLAUSE_MODEL`: `gemini-3.7-flash` (Deep exclusion & legal amparo extraction).
   - `GEMINI_CHAT_MODEL`: `gemini-3.1-flash-lite` (Ultra-fast interactive user Q&A).
   - `GEMINI_EMBEDDING_MODEL`: `models/gemini-embedding-2` (Multimodal vector indexing).

3. **Clause Search Store Service (`clauseSearchStore.ts`):**
   - Implements `getOrCreateStoreForInsurer(insurerId, domain)`
   - Implements `uploadAndImportClausePdf(storeName, filePath, metadata)`
   - Implements `buildFileSearchToolConfig(storeNames)`
