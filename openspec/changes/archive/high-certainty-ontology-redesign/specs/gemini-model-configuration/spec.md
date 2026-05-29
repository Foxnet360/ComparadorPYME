## MODIFIED Requirements

### Requirement: All Gemini models are configurable via environment variables
The system SHALL read all Gemini model selections from environment variables with sensible defaults.

#### Scenario: PDF extraction uses configured model
- **WHEN** the system extracts data from a PDF quote
- **THEN** it SHALL use the model specified in `GEMINI_MODEL` environment variable
- **AND** if `GEMINI_MODEL` is not set, it SHALL default to `gemini-3.5-flash`

#### Scenario: Chat uses configured model
- **WHEN** the system processes a chat message
- **THEN** it SHALL use the model specified in `GEMINI_CHAT_MODEL` environment variable
- **AND** if `GEMINI_CHAT_MODEL` is not set, it SHALL default to `gemini-2.5-flash-lite`

#### Scenario: Embeddings use configured model
- **WHEN** the system generates embeddings for text
- **THEN** it SHALL use the model specified in `GEMINI_EMBEDDING_MODEL` environment variable
- **AND** if `GEMINI_EMBEDDING_MODEL` is not set, it SHALL default to `gemini-embedding-2`

#### Scenario: Clause extraction uses configured model
- **WHEN** the system extracts structured clauses from documents
- **THEN** it SHALL use the model specified in `GEMINI_CLAUSE_MODEL` environment variable
- **AND** if `GEMINI_CLAUSE_MODEL` is not set, it SHALL default to `gemini-3.5-flash`
