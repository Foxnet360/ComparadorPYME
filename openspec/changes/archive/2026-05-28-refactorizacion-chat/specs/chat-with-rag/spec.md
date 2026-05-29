## Delta from change: refactorizacion-chat

## MODIFIED Requirements

### Requirement: Chat funcional con backend
El sistema DEBE procesar mensajes de chat en el backend con contexto del reporte y persistencia en base de datos.

#### Scenario: Enviar mensaje con persistencia
- **WHEN** el usuario escribe "¿Qué deducible tiene AXA?"
- **THEN** el backend recibe el mensaje + reportContext
- **AND** obtiene o crea el thread asociado al report_id
- **AND** recupera historial desde la base de datos (no desde el frontend)
- **AND** genera embedding de la pregunta
- **AND** busca chunks relevantes en RAG (siempre activo)
- **AND** construye prompt con contexto compactado + chunks + historial
- **AND** llama a Gemini Flash-Lite
- **AND** guarda la respuesta en chat_messages
- **AND** retorna respuesta con citas y fuentes usadas

### Requirement: Toggle RAG
**REMOVED**: El toggle de RAG es eliminado. La búsqueda en clausulados está siempre activa.

#### Scenario: RAG siempre activo
- **WHEN** el usuario envía cualquier pregunta
- **THEN** el sistema siempre busca en clausulados estructurados y chunks vectoriales
- **AND** indica explícitamente la fuente de cada dato (📄 cotización, 📋 clausulado, ℹ️ conocimiento general)

### Requirement: Preguntas dinámicas
El sistema DEBE sugerir preguntas basadas en el reporte actual.

#### Scenario: Sugerencias contextuales
- **WHEN** el reporte tiene alerta de deducible alto
- **THEN** sugiere: "¿Por qué el deducible es alto?"
- **AND** si hay score bajo: "¿Qué afectó el score?"

## ADDED Requirements

### Requirement: Context window management
El sistema DEBE controlar el tamaño del prompt para no exceder el límite de tokens.

#### Scenario: Compactar contexto del reporte
- **WHEN** el reporte tiene múltiples cotizaciones con muchas coberturas
- **THEN** el sistema genera un resumen compacto (aseguradoras, coberturas clave, alertas críticas)
- **AND** solo incluye detalles completos de la aseguradora/cobertura mencionada en la pregunta

### Requirement: Endpoint para recuperar historial por reporte
El sistema DEBE exponer un endpoint para cargar la conversación de un análisis específico.

#### Scenario: Cargar historial existente
- **WHEN** el frontend hace GET /api/chat/threads/report/:reportId
- **THEN** el backend devuelve el thread_id y los mensajes asociados
- **AND** ordenados por created_at ascendente
