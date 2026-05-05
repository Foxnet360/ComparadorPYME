# Tasks: Reactivar SeguroBot RAG Chat

## Backend

- [x] Create `server/src/services/chatService.ts`
  - [x] Implement `processChatMessage(message, reportContext, useRAG)`
  - [x] If useRAG: generate embedding, call `ragRetrievalService.hybridSearch()`
  - [x] Build system prompt with strict instructions: "Responde solo basado en el contexto"
  - [x] Build user prompt with report summary + relevant chunks
  - [x] Call Gemini 2.5 Flash-Lite (model: `gemini-2.5-flash-lite`)
  - [x] Parse response, extract citations, return {text, citations[], tokensUsed}
  - [x] Implement fallback to `gemini-2.5-flash` if reasoning needed (optional)
  - [x] Add token usage tracking/logging
- [x] Create `server/src/routes/chat.ts`
  - [x] POST /api/chat — receives {message, reportContext, useRAG, history}
  - [x] Validate input
  - [x] Call chatService
  - [x] Return 200 with {response, citations[], tokensUsed}
  - [x] Add rate limiting (e.g., max 20 messages/min)
- [x] Register new route in server entry point
- [x] Add `GEMINI_CHAT_MODEL` env variable (default: gemini-2.5-flash-lite)

## Frontend

- [x] Fix `services/geminiService.ts`
  - [x] Implement real `createChatSession()` (currently returns null)
  - [x] Function should return session object with `sendMessage()` method
  - [x] `sendMessage()` calls POST /api/chat
  - [x] Handle streaming or standard response
- [x] Redesign `components/ChatBot.tsx`
  - [x] Add RAG toggle switch "Usar clausulados" (default: ON)
  - [x] Add dynamic suggested questions based on report content
  - [x] Show citation cards in responses
  - [x] Show token usage / cost indicator (optional)
  - [x] Add chat history persistence (sessionStorage)
  - [x] Show loading indicator while waiting for response
  - [x] Show error state if API fails
- [x] Update `App.tsx`
  - [x] Reactivate chat button (currently hidden)
  - [x] Ensure chat button is visible in appropriate states
  - [x] Pass report context to ChatBot
- [x] Create `generateSuggestedQuestions(report)` utility
  - [x] Generate 3-5 questions based on alerts, scores, coverage gaps
  - [x] Examples: "¿Por qué [aseguradora] tiene score bajo?", "¿Qué cubre [cobertura]?"

## Integration & Testing

- [x] Test chat with RAG enabled
- [x] Test chat with RAG disabled
- [x] Test suggested questions generation
- [x] Test rate limiting
- [x] Run `npm run build` to verify no errors
