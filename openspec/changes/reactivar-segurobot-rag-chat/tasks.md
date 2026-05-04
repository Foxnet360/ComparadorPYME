# Tasks: Reactivar SeguroBot RAG Chat

## Backend

- [ ] Create `server/src/services/chatService.ts`
  - [ ] Implement `processChatMessage(message, reportContext, useRAG)`
  - [ ] If useRAG: generate embedding, call `ragRetrievalService.hybridSearch()`
  - [ ] Build system prompt with strict instructions: "Responde solo basado en el contexto"
  - [ ] Build user prompt with report summary + relevant chunks
  - [ ] Call Gemini 2.5 Flash-Lite (model: `gemini-2.5-flash-lite`)
  - [ ] Parse response, extract citations, return {text, citations[], tokensUsed}
  - [ ] Implement fallback to `gemini-2.5-flash` if reasoning needed (optional)
  - [ ] Add token usage tracking/logging
- [ ] Create `server/src/routes/chat.ts`
  - [ ] POST /api/chat — receives {message, reportContext, useRAG, history}
  - [ ] Validate input
  - [ ] Call chatService
  - [ ] Return 200 with {response, citations[], tokensUsed}
  - [ ] Add rate limiting (e.g., max 20 messages/min)
- [ ] Register new route in server entry point
- [ ] Add `GEMINI_CHAT_MODEL` env variable (default: gemini-2.5-flash-lite)

## Frontend

- [ ] Fix `services/geminiService.ts`
  - [ ] Implement real `createChatSession()` (currently returns null)
  - [ ] Function should return session object with `sendMessage()` method
  - [ ] `sendMessage()` calls POST /api/chat
  - [ ] Handle streaming or standard response
- [ ] Redesign `components/ChatBot.tsx`
  - [ ] Add RAG toggle switch "Usar clausulados" (default: ON)
  - [ ] Add dynamic suggested questions based on report content
  - [ ] Show citation cards in responses
  - [ ] Show token usage / cost indicator (optional)
  - [ ] Add chat history persistence (sessionStorage)
  - [ ] Show loading indicator while waiting for response
  - [ ] Show error state if API fails
- [ ] Update `App.tsx`
  - [ ] Reactivate chat button (currently hidden)
  - [ ] Ensure chat button is visible in appropriate states
  - [ ] Pass report context to ChatBot
- [ ] Create `generateSuggestedQuestions(report)` utility
  - [ ] Generate 3-5 questions based on alerts, scores, coverage gaps
  - [ ] Examples: "¿Por qué [aseguradora] tiene score bajo?", "¿Qué cubre [cobertura]?"

## Integration & Testing

- [ ] Test chat with RAG enabled
- [ ] Test chat with RAG disabled
- [ ] Test suggested questions generation
- [ ] Test rate limiting
- [ ] Run `npm run build` to verify no errors
