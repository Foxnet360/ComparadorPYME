## MODIFIED Requirements

### Requirement: Chat funcional con backend
El sistema DEBE procesar mensajes de chat en el backend con contexto del reporte y HISTORIAL de conversación.

#### Scenario: Enviar mensaje con contexto
- **WHEN** el usuario escribe "¿Qué deducible tiene AXA?"
- **THEN** el backend recibe el mensaje + contexto del reporte
- **AND** recupera los últimos N mensajes del thread activo
- **AND** genera embedding de la pregunta
- **AND** busca chunks relevantes en RAG (tabla `chunks` unificada)
- **AND** construye prompt con historial + contexto + chunks
- **AND** llama a Gemini Flash-Lite
- **AND** retorna respuesta con citas
- **AND** guarda mensaje y respuesta en `chat_messages`

#### Scenario: Conversación de seguimiento
- **WHEN** el usuario pregunta "¿Y cuál es el límite?" (refiriéndose a cobertura anterior)
- **THEN** el sistema DEBE entender el contexto de la conversación previa
- **AND** incluir los últimos 5 mensajes en el prompt
- **AND** generar respuesta coherente con la conversación

## ADDED Requirements

### Requirement: Persistencia de conversaciones
El sistema DEBE guardar todas las conversaciones del chat en la base de datos.

#### Scenario: Crear thread nuevo
- **WHEN** se genera un nuevo reporte
- **THEN** el sistema DEBE crear un `chat_thread` asociado al reporte
- **AND** asignar un título descriptivo

#### Scenario: Recuperar thread existente
- **WHEN** el usuario retoma una conversación anterior
- **THEN** el sistema DEBE cargar todos los mensajes del thread
- **AND** mostrarlos en orden cronológico
