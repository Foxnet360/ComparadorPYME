## Context

El chat está deshabilitado desde hace tiempo:
- `createChatSession` retorna null
- Botón solo visible post-análisis
- No hay integración con RAG

El modelo debe ser cost-effective porque:
- Chat es uso intensivo (múltiples mensajes por sesión)
- El contexto puede ser grande (reporte completo + chunks)

## Goals / Non-Goals

**Goals:**
- Chat funcional con contexto de cotizaciones
- Integración RAG para consultas sobre clausulados
- Preguntas sugeridas dinámicas
- Citas de fuentes en respuestas
- Costo mínimo por conversación

**Non-Goals:**
- No implementar memoria de largo plazo (session-only)
- No soportar multimodal (solo texto)
- No reemplazar el análisis principal (solo complementa)

## Decisions

### 1. Modelo: Gemini 2.5 Flash-Lite
**Decisión:** Usar `gemini-2.5-flash-lite` ($0.10/1M input tokens)
**Rationale:**
- 10x más barato que Pro
- Context window de 1M tokens (suficiente)
- Calidad suficiente para Q&A sobre documentos
- Fallback a `gemini-2.5-flash` si necesita reasoning

### 2. Arquitectura Backend
**Decisión:** Chat va por backend (no cliente directo a Gemini)
**Rationale:**
- Protege API key
- Permite búsqueda RAG antes de llamar a Gemini
- Mejor control de costos y logging

### 3. Preguntas dinámicas
**Decisión:** Generar sugerencias basadas en contenido del reporte
**Ejemplos:**
- Si hay alerta de deducible: "¿Qué deducible tiene [aseguradora]?"
- Si hay score bajo: "¿Por qué [aseguradora] tiene score bajo?"
- Si hay exclusión: "¿Qué cubre [cobertura] en [aseguradora]?"

### 4. Toggle RAG
**Decisión:** Switch "Usar clausulados" (default: ON)
**Rationale:** Permite al usuario elegir si quiere respuestas basadas solo en cotizaciones o enriquecidas con clausulados

## Risks / Trade-offs

**Riesgo:** Costo acumulado de chat (muchas conversaciones)
**Mitigación:** Limitar contexto a 10K tokens, usar modelo barato, rate limiting

**Riesgo:** Respuestas alucinadas sin RAG
**Mitigación:** Instrucciones de sistema estrictas: "Responde solo basado en el contexto proporcionado"

**Riesgo:** Latencia en búsqueda RAG + LLM
**Mitigación:** Timeout de 10s, streaming de respuesta

## Migration Plan

1. Crear chatService en backend
2. Crear endpoint /api/chat
3. Implementar createChatSession real
4. Rediseñar ChatBot UI
5. Testing

## Open Questions

1. ¿Debe haber límite de mensajes por sesión?
2. ¿Se necesita persistencia de conversaciones?
