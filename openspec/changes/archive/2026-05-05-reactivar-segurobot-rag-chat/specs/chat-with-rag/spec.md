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
