## ADDED Requirements

### Requirement: Chat funcional con backend
El sistema DEBE procesar mensajes de chat en el backend con contexto del reporte.

#### Scenario: Enviar mensaje
- **WHEN** el usuario escribe "¿Qué deducible tiene AXA?"
- **THEN** el backend recibe el mensaje + contexto del reporte
- **AND** genera embedding de la pregunta
- **AND** busca chunks relevantes en RAG
- **AND** construye prompt con contexto + chunks
- **AND** llama a Gemini Flash-Lite
- **AND** retorna respuesta con citas

### Requirement: Toggle RAG
El usuario DEBE poder elegir si usar clausulados en las respuestas.

#### Scenario: RAG activado
- **WHEN** toggle "Usar clausulados" está ON
- **THEN** las respuestas incluyen búsqueda RAG

#### Scenario: RAG desactivado
- **WHEN** toggle está OFF
- **THEN** las respuestas usan solo el contexto del reporte

### Requirement: Preguntas dinámicas
El sistema DEBE sugerir preguntas basadas en el reporte actual.

#### Scenario: Sugerencias contextuales
- **WHEN** el reporte tiene alerta de deducible alto
- **THEN** sugiere: "¿Por qué el deducible es alto?"
- **AND** si hay score bajo: "¿Qué afectó el score?"

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Use quote data as primary chat source
The system SHALL prioritize extracted quote data over RAG results when answering questions.

#### Scenario: Answer from quote data
- **WHEN** a user asks about coverage details
- **THEN** the chat first checks the extracted quote data
- **AND" responds with quote data even if RAG returns no results

### Requirement: Include source attribution in responses
The system SHALL clearly indicate which source (quote, clause, or general knowledge) provided each piece of information.

#### Scenario: Source attribution
- **WHEN** the chat provides an answer
- **THEN** it labels the source:
  - "📄 According to the quote..."
  - "📋 According to clause documents..."
  - "ℹ️ General insurance knowledge..."

## MODIFIED Requirements

### Requirement: Retrieve clause context for chat
The system SHALL retrieve relevant clause context when answering questions about specific coverages.

#### Scenario: Clause context retrieval
- **WHEN** a user asks about a specific coverage
- **THEN** the system searches for relevant clause chunks
- **AND" includes matching clause excerpts in the chat prompt
- **AND" cites the insurer and page number for each excerpt

### Requirement: Use structured clause data for chat
The system SHALL query structured clause JSON when available, falling back to vector chunks.

#### Scenario: Structured clause query
- **WHEN** a user asks "What is CHUBB's earthquake deductible?"
- **THEN** the system queries the structured_clauses table
- **AND" returns the exact deductible value
- **AND" cites the specific clause document

## REMOVED Requirements

### Requirement: Respond with "I don't have information" when RAG fails
**Reason**: Quote data is always available as fallback
**Migration**: Chat now always provides answer from quote data when RAG fails
