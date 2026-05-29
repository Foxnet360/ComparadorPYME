## ADDED Requirements

### Requirement: Conversations persist in database
The system SHALL store all chat conversations in PostgreSQL tables.

#### Scenario: Save user message
- **WHEN** a user sends a message
- **THEN** the system inserts a row into `chat_messages` with role='user', content, and timestamp
- **AND** links it to the active `chat_threads` row

#### Scenario: Save model response
- **WHEN** the model generates a response
- **THEN** the system inserts a row into `chat_messages` with role='model', content, sources_used, citations, and model_used
- **AND** includes token counts and latency_ms

### Requirement: Thread isolation per analysis
The system SHALL create one chat thread per unique combination of `user_id` and `report_id`.

#### Scenario: New analysis creates new thread
- **WHEN** a user starts a new quote analysis for a client
- **AND** the chat is opened for that analysis
- **THEN** the system creates a new `chat_threads` row with the `report_id`
- **AND** the conversation history is empty

#### Scenario: Reopening existing analysis loads history
- **WHEN** a user reopens a previously analyzed report
- **AND** clicks the chat button
- **THEN** the system retrieves the existing thread for that `report_id`
- **AND** loads all associated messages from `chat_messages`

### Requirement: Thread metadata tracking
The system SHALL store thread metadata including client name, insurer names, and context summary.

#### Scenario: Thread created with report context
- **WHEN** a thread is created for a report
- **THEN** the system stores `client_name` from the report
- **AND** stores `insurer_names` as an array
- **AND** generates a compact `context_summary` for prompt building

## Delta from change: refactorizacion-chat

## ADDED Requirements

### Requirement: Database-backed chat persistence
The system SHALL persist all chat conversations in PostgreSQL with thread isolation per analysis.

#### Scenario: Message persistence
- **WHEN** any message is sent or received
- **THEN** it is stored in `chat_messages` table
- **AND** linked to `chat_threads` via `thread_id`

#### Scenario: Thread per report
- **WHEN** a user opens chat for a report
- **THEN** the system finds or creates a thread keyed by `user_id` + `report_id`
- **AND** loads historical messages from the database
