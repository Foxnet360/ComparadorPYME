## ADDED Requirements

### Requirement: Crear tablas de chat
El sistema DEBE crear tablas en Supabase para persistir conversaciones del chat.

#### Scenario: Crear tabla chat_threads
- **WHEN** se ejecuta la migración SQL
- **THEN** el sistema DEBE crear tabla `chat_threads` con campos: id, user_id, report_id, title, created_at, updated_at
- **AND** índice en user_id para búsqueda rápida

#### Scenario: Crear tabla chat_messages
- **WHEN** se ejecuta la migración SQL
- **THEN** el sistema DEBE crear tabla `chat_messages` con campos: id, thread_id, role, content, citations, model_used, tokens_used, created_at
- **AND** foreign key a chat_threads
- **AND** índice en thread_id

### Requirement: Persistir conversaciones
El sistema DEBE guardar cada mensaje del chat en la base de datos.

#### Scenario: Guardar mensaje del usuario
- **WHEN** el usuario envía un mensaje
- **THEN** el sistema DEBE crear o recuperar el thread activo
- **AND** insertar el mensaje en `chat_messages` con role='user'
- **AND** incluir el texto completo del mensaje

#### Scenario: Guardar respuesta del modelo
- **WHEN** el modelo genera una respuesta
- **THEN** el sistema DEBE insertar la respuesta en `chat_messages` con role='model'
- **AND** incluir citas si las hay
- **AND** guardar metadata (modelo usado, tokens)

### Requirement: Recuperar historial de conversación
El sistema DEBE incluir el historial reciente de mensajes en el prompt para mantener contexto.

#### Scenario: Contexto de conversación previa
- **WHEN** el usuario hace una pregunta de seguimiento
- **THEN** el sistema DEBE recuperar los últimos N mensajes del thread
- **AND** incluirlos en el prompt como historial
- **AND** el modelo DEBE entender referencias contextuales ("y esa cobertura?")

#### Scenario: Nuevo thread por reporte
- **WHEN** se genera un nuevo reporte de análisis
- **THEN** el sistema DEBE crear un nuevo chat_thread
- **AND** asociarlo al reporte actual
- **AND** mantener threads anteriores disponibles

### Requirement: Listar threads históricos
El sistema DEBE permitir al usuario ver y retomar conversaciones anteriores.

#### Scenario: Listar conversaciones previas
- **WHEN** el usuario abre el panel de chat
- **THEN** el sistema DEBE mostrar lista de threads anteriores
- **AND** ordenados por fecha de actualización
- **AND** con preview del último mensaje
