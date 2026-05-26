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
