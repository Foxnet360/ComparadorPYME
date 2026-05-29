## 1. Database Infrastructure

- [x] 1.1 Create migration `015_chat_system.sql` with `chat_threads` and `chat_messages` tables
- [x] 1.2 Add indexes on `chat_threads(user_id)`, `chat_threads(report_id)`, `chat_messages(thread_id)`
- [x] 1.3 Add trigger for `updated_at` on `chat_threads`
- [x] 1.4 Run migration against Supabase and verify tables exist
- [x] 1.5 Update `database.ts` types if TypeScript compilation fails with new tables

## 2. Backend Repository Layer

- [x] 2.1 Create `server/src/repositories/chatRepository.ts` with interface:
  - `createThread(userId, reportContext)`
  - `getOrCreateThread(userId, reportId, clientName)`
  - `saveMessage(threadId, message)`
  - `getHistory(threadId, limit)`
  - `getThreadByReport(userId, reportId)`
  - `archiveThread(threadId)`
- [x] 2.2 Add unit tests for `chatRepository` with mocked Supabase client
- [x] 2.3 Verify repository handles edge cases (missing thread, empty history, large messages)

## 3. Backend Service Refactoring

- [x] 3.1 Create `ContextWindowManager` class in `chatService.ts`:
  - `compactReportContext(report)` → summary string
  - `buildPrompt(systemPrompt, reportSummary, sources, history, message)` → controlled prompt
  - Enforce max token budget (12k input)
- [x] 3.2 Create `SourcePrioritizer` class in `chatService.ts`:
  - `gatherSources(message, reportContext)` → parallel search (quote, structured, RAG)
  - `rankAndDeduplicate(sources)` → sorted unique sources
  - Return top 3 most relevant sources
- [x] 3.3 Refactor `processChatMessage()`:
  - Remove `useRAG` parameter
  - Remove `history` from function signature (load from DB)
  - Use `chatRepository` for persistence
  - Use `ContextWindowManager` for prompt building
  - Use `SourcePrioritizer` for source gathering
  - Save response metadata (sources_used, citations, tokens, latency)
- [x] 3.4 Update `generateSuggestedQuestions()` to accept `reportContext` only (no API changes)
- [x] 3.5 Add response validation: check that model output doesn't contradict quote data

## 4. Backend Routes

- [x] 4.1 Update `POST /api/chat`:
  - Remove `useRAG` from request body
  - Remove `history` from request body
  - Accept `threadId` optional parameter
  - Derive thread from `reportContext.id` if not provided
- [x] 4.2 Add `GET /api/chat/threads/report/:reportId`:
  - Return `{ threadId, messages[] }` for the report
  - Create thread if it doesn't exist
- [x] 4.3 Add `DELETE /api/chat/threads/:id`:
  - Soft delete (update status to 'archived')
- [x] 4.4 Update `POST /api/chat/suggestions` (no changes needed, verify still works)
- [x] 4.5 Add integration tests for new endpoints

## 5. Frontend ChatBot Component

- [x] 5.1 Remove `useRAG` state and toggle UI from `ChatBot.tsx`
- [x] 5.2 Add `threadId` state management
- [x] 5.3 Implement `loadThread(reportId)`:
  - Call `GET /api/chat/threads/report/:reportId`
  - Populate messages state
  - Store threadId
- [x] 5.4 Update `handleSendMessage()`:
  - Remove `history` from request body
  - Remove `useRAG` from request body
  - Include `threadId` in request body
- [x] 5.5 Add `useEffect` to reset chat when `reportContext.id` changes:
  - Clear messages
  - Load new thread for the report
- [x] 5.6 Update message rendering to show source badges (📄 📋 ℹ️) based on `msg.source`
- [x] 5.7 Remove `geminiService.ts` `createChatSession` function (unused, superseded by backend)

## 6. Testing & Validation

- [x] 6.1 Write integration test: full flow (send message → persist → reload page → history present)
- [x] 6.2 Write test: conversation isolation (two reports, messages don't mix)
- [x] 6.3 Write test: RAG always-on (verify clause search is performed even without toggle)
- [x] 6.4 Write test: source attribution (verify response includes source labels)
- [x] 6.5 Manual QA: open chat, ask question, refresh page, verify history loads
- [x] 6.6 Manual QA: start new analysis, verify chat is fresh (no old messages)
- [x] 6.7 Run existing `chatService.test.ts` and fix any regressions

## 7. Deployment

- [x] 7.1 Run migration `015_chat_system.sql` in production Supabase
- [x] 7.2 Deploy backend to Cloud Run
- [x] 7.3 Deploy frontend to Vercel
- [x] 7.4 Verify in production: create analysis, send chat messages, refresh, confirm persistence
- [x] 7.5 Monitor error logs for 24h
