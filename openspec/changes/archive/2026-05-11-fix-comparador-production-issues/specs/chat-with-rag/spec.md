## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Fallback a contexto de cotizaciones
El chat DEBE usar los datos de cotizaciones del reporte actual cuando RAG no retorna resultados relevantes.

#### Scenario: RAG sin resultados
- **WHEN** la búsqueda RAG no encuentra chunks relevantes
- **THEN** el chat usa el `reportContext` con los datos de cotizaciones
- **AND** genera una respuesta basada en la comparación de coberturas
- **AND** NO responde "No tengo información suficiente"

#### Scenario: Chat con datos de deducibles
- **WHEN** el usuario pregunta "¿Qué deducible tiene AXA?"
- **AND** no hay clausulados indexados para AXA
- **THEN** el chat responde usando los deducibles extraídos de la cotización de AXA
- **AND** aclara que la información proviene de la cotización, no del clausulado

#### Scenario: Contexto combinado
- **WHEN** hay tanto datos de cotización como chunks de clausulados
- **THEN** el chat combina ambas fuentes
- **AND** prioriza los clausulados pero completa con datos de cotización
