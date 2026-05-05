## Why

El SeguroBot AI está actualmente DESHABILITADO en producción:
- `createChatSession` retorna `null` (mock)
- El botón solo aparece cuando el análisis está completo
- No tiene acceso al contexto de las cotizaciones ni a los clausulados RAG
- Las respuestas serían genéricas sin fundamentación en los documentos analizados

Los corredores necesitan poder hacer preguntas específicas sobre:
- Comparaciones entre deducibles de diferentes aseguradoras
- Explicaciones de coberturas específicas
- Análisis de riesgos encontrados
- Consultas sobre clausulados adjuntos

## What Changes

- **Reactivar chat en backend**: Crear endpoint `/api/chat` que recibe mensaje + contexto del reporte + chunks RAG
- **Modelo eficiente**: Usar `gemini-2.5-flash-lite` ($0.10/1M tokens input) para minimizar costos
- **Contexto enriquecido**: Prompt incluye resumen del reporte + chunks relevantes de clausulados
- **RAG Integration**: Para preguntas sobre clausulados, buscar en Supabase antes de responder
- **Preguntas dinámicas**: Sugerencias basadas en el contenido específico del reporte
- **UI/UX mejorada**: Indicador de contexto, toggle RAG, citas en respuestas

## Capabilities

### New Capabilities
- `chat-with-rag`: Chatbot con acceso a clausulados vía búsqueda vectorial
- `dynamic-suggestions`: Preguntas sugeridas basadas en el reporte actual
- `citation-cards`: Mostrar fuentes de clausulados en las respuestas
- `report-context-chat`: Chat contextualizado con datos de cotizaciones

### Modified Capabilities
- `chatbot-ui`: Rediseño completo del componente ChatBot
- `app-header`: Botón de chat siempre visible (con estados apropiados)

## Impact

**Archivos afectados:**
- Backend: `server/src/services/chatService.ts` (nuevo)
- Backend: `server/src/routes/chat.ts` (nuevo endpoint)
- Frontend: `components/ChatBot.tsx` (rediseño)
- Frontend: `App.tsx` (reactivar chat session)
- Frontend: `services/geminiService.ts` (implementar createChatSession)

**APIs:** Nuevo endpoint `POST /api/chat`

**Dependencies:** 
- Google GenAI SDK (ya instalado)
- Supabase RAG (ya configurado)
- Embedding service existente

**Variables de entorno:** 
- `GEMINI_API_KEY` (ya existe)
- `GEMINI_CHAT_MODEL` (nueva, opcional, default: gemini-2.5-flash-lite)

**Breaking changes:** Ninguno. Feature opt-in.
