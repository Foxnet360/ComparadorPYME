## Delta from change: refactorizacion-chat

## MODIFIED Requirements

### Requirement: Prioritize quote data as primary source
The system SHALL use extracted quote data as the primary and authoritative source for chat responses. Clause documents and general knowledge are secondary and MUST NOT contradict quote data.

#### Scenario: Answer deductible question with quote data
- **WHEN** a user asks "What are CHUBB's deductibles?"
- **THEN** the chat first searches the extracted quote data
- **AND** responds with: "According to CHUBB's quote: AMPARO BÁSICO has 10% deductible with minimum 5 SMMLV"
- **AND** if clause data contradicts the quote, alerts the user with the discrepancy

### Requirement: Fallback to structured clauses
The system SHALL search structured clause documents when quote data is insufficient, but NEVER override quote values with clause values.

#### Scenario: Detailed clause question
- **WHEN** a user asks "What exclusions apply to CHUBB's earthquake coverage?"
- **AND** the quote data doesn't list exclusions
- **THEN** the chat searches structured clause database
- **AND** responds with specific exclusions from clause document
- **AND** labels source as 📋 clausulado

### Requirement: Use general knowledge as last resort
The system SHALL use general insurance knowledge only when neither quote data nor clauses provide an answer.

#### Scenario: General insurance question
- **WHEN** a user asks "What is a deductible in insurance?"
- **AND** neither quote nor clauses answer this
- **THEN** the chat uses general knowledge
- **AND** clearly labels it as ℹ️ General insurance knowledge

### Requirement: Never respond with "I don't have information" when quote data exists
The system SHALL always provide an answer based on available quote data before stating lack of information.

#### Scenario: User asks about coverage details
- **WHEN** a user asks about a coverage present in the quote
- **AND** RAG retrieval fails
- **THEN** the chat still answers using quote data
- **AND** never says "I don't have information" for data that exists in the quote

## ADDED Requirements

### Requirement: Source ranking and deduplication
The system SHALL rank sources by relevance and authority before constructing the LLM prompt.

#### Scenario: Multiple sources for same coverage
- **WHEN** a user asks about "Incendio" coverage
- **AND** quote data, structured clauses, and RAG chunks all have information
- **THEN** the system ranks them: quote data first (authority 1.0), structured clauses second (0.8), RAG chunks third (0.6)
- **AND** deduplicates overlapping content
- **AND** includes top 3 most relevant sources in the prompt

### Requirement: Response validation against quote data
The system SHALL validate that the LLM response does not contradict quote data.

#### Scenario: Detect contradiction
- **WHEN** the model responds with a deductible value
- **AND** the quote data shows a different value for the same coverage
- **THEN** the system detects the contradiction
- **AND** either regenerates the response or appends a correction disclaimer
