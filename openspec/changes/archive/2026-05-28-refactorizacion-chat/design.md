## Context

The chatbot currently lives entirely in frontend state (`useState` in `ChatBot.tsx`) with no database persistence. The backend `chatService.ts` attempts to use `chat_threads` and `chat_messages` tables that do not exist in the schema. This results in:
- Lost conversations on page refresh
- Context bleeding between different client analyses
- A non-functional RAG toggle (visual only, doesn't change behavior meaningfully)
- Inconsistent responses due to uncontrolled prompt construction (entire report context dumped into a flat string)

The goal is to transform the chat into a reliable expert advisor for insurance quotes and clauses.

## Goals / Non-Goals

**Goals:**
- Persist every conversation in PostgreSQL with proper thread isolation per analysis
- Guarantee conversation isolation (one thread per `report_id` + `user_id`)
- Remove the RAG toggle; clause search is always active with visible source attribution
- Control context window size to prevent token overflow and reduce latency
- Rank and deduplicate sources before sending to LLM (quote data > structured clauses > RAG chunks)

**Non-Goals:**
- Real-time chat (WebSockets, streaming)
- Multi-user collaborative chat
- Exporting chat history to PDF/email
- Changing the LLM model (remains Gemini Flash-Lite)

## Decisions

### 1. Database Schema: `chat_threads` + `chat_messages`
**Rationale**: Native Supabase tables provide ACID guarantees, simple backup, and work with existing RLS/auth patterns. No need to introduce Redis or external stores for MVP.

### 2. Thread Key = `user_id` + `report_id`
**Rationale**: Guarantees isolation. If a user re-analyzes the same client, a new `report_id` creates a fresh thread. No risk of stale context.

### 3. Context Window Manager with Report Compaction
**Rationale**: Current code sends the FULL `reportContext` (all quotes, all coverages, all alerts) in every prompt. This wastes tokens and degrades LLM focus. The new design compacts the report to a summary (insurer names, key coverages, critical alerts) and only includes full details for the insurer/coverage being asked about.

### 4. Source Prioritizer: Parallel Search + Ranking
**Rationale**: The current code searches sources sequentially. Parallel `Promise.all` reduces latency. A ranking layer (relevance score + source type weight) ensures the LLM receives the most authoritative information first.

### 5. Remove RAG Toggle, Always-On with Attribution
**Rationale**: Users don't know when to toggle RAG. It's better to always search clauses and clearly label sources. If no clauses are found, the system falls back to quote data or general knowledge transparently.

### 6. Frontend: Load History from Backend, Reset on Report Change
**Rationale**: The frontend currently passes `history` in the POST body, which duplicates state. The new design loads history when the chat opens and only sends the current message. When `reportContext.id` changes, the component resets to a fresh state.

## Risks / Trade-offs

- **[Risk]** Database migration `015_chat_system.sql` must run before deployment → **Mitigation**: Include in deployment checklist; tables are additive and safe.
- **[Risk]** Compacting report context might lose nuanced details → **Mitigation**: Keep full quote data accessible; only compact the "context summary" portion. If a question requires details, fetch them on-demand.
- **[Risk]** Always-on RAG increases latency (embedding + DB query) → **Mitigation**: Parallelize searches; add caching for frequent queries; set aggressive timeouts (3s) with graceful fallback.
- **[Risk]** Existing users may have "orphaned" frontend-only conversations → **Mitigation**: This is acceptable; they start fresh with the new system. No migration needed.

## Migration Plan

1. Deploy migration `015_chat_system.sql` to Supabase
2. Deploy backend changes (new repository, refactored service, updated routes)
3. Deploy frontend changes (ChatBot.tsx, geminiService.ts)
4. Verify: create new analysis, send messages, refresh page, confirm persistence
5. Rollback: revert to previous commit (tables are additive, no data loss)

## Open Questions

- Should we implement a "soft delete" for threads or hard delete with `archived_at`?
- What's the token budget per message? (Proposed: 12k input, 2k output)
- Do we need pagination for long conversation histories? (Proposed: load last 20 messages)
