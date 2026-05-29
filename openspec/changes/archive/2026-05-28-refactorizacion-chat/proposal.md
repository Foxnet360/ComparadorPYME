## Why

The current chatbot implementation has critical architectural flaws that prevent it from serving as a reliable RAG expert for insurance quotes and clauses. Conversations don't persist (tables `chat_threads` and `chat_messages` don't exist), context bleeds between clients, the RAG ON/OFF toggle is non-functional, and responses are frequently decontextualized or contradictory to quote data. This undermines user trust and makes the chat feature unreliable for professional insurance brokerage work.

## What Changes

- **Persist conversations in database**: Create `chat_threads` and `chat_messages` tables with proper indexing. Conversations are tied to `user_id`, `report_id`, and `client_name`.
- **Isolate conversations per analysis**: Each quote analysis gets its own thread. Switching clients or starting a new analysis creates a fresh conversation context.
- **Eliminate RAG toggle**: Remove the ON/OFF switch. RAG (clauses) and LLM knowledge are always active, with clear source attribution in every response.
- **Improve response quality**: Implement context window management, source prioritization (quote data > structured clauses > RAG chunks), and response validation against quote data.
- **Add conversation history endpoint**: `GET /api/chat/threads/report/:reportId` to load previous messages when reopening a chat.
- **Clean up frontend state**: `ChatBot.tsx` resets messages when `reportContext` changes and loads history from the backend.

## Capabilities

### New Capabilities
- `chat-persistence`: Database-backed conversation storage with thread isolation per analysis

### Modified Capabilities
- `chat-with-rag`: Requirement changes:
  - Conversations MUST persist in database (not just frontend state)
  - Each analysis/report MUST have isolated thread (no context bleeding)
  - RAG toggle is removed; clause search is always performed
  - Response MUST include explicit source attribution (📄 quote, 📋 clause, ℹ️ general)
- `triple-source-chat`: Requirement changes:
  - Source 1 (quote data) is authoritative and cannot be contradicted by other sources
  - Sources are ranked and deduplicated before being sent to LLM
  - System prompt enforces source priority and citation format

## Impact

- **Frontend**: `components/ChatBot.tsx` (remove toggle, load/save history, reset on report change)
- **Backend**: 
  - `server/src/services/chatService.ts` (refactor with repository pattern, context window, source prioritizer)
  - `server/src/routes/chat.ts` (new endpoint for report-based thread retrieval)
  - `server/src/repositories/chatRepository.ts` (new file)
- **Database**: New migration `015_chat_system.sql` (`chat_threads`, `chat_messages` tables)
- **API Contract**: `POST /api/chat` no longer accepts `useRAG` or `history`; requires `threadId` or derives it from `reportContext.id`
