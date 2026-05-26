## ADDED Requirements

### Requirement: Prioritize quote data as primary source
The system SHALL use extracted quote data as the primary source for chat responses, with clause documents and general knowledge as secondary sources.

#### Scenario: Answer deductible question with quote data
- **WHEN" a user asks "What are CHUBB's deductibles?"
- **THEN** the chat first searches the extracted quote data
- **AND** responds with: "According to CHUBB's quote: AMPARO BÁSICO has 10% deductible with minimum 5 SMMLV"
- **AND" includes a disclaimer: "Based on quote data, not clause document"

### Requirement: Fallback to structured clauses
The system SHALL search structured clause documents when quote data is insufficient.

#### Scenario: Detailed clause question
- **WHEN" a user asks "What exclusions apply to CHUBB's earthquake coverage?"
- **AND** the quote data doesn't list exclusions
- **THEN** the chat searches structured clause database
- **AND" responds with specific exclusions from clause document

### Requirement: Use general knowledge as last resort
The system SHALL use general insurance knowledge only when neither quote data nor clauses provide an answer.

#### Scenario: General insurance question
- **WHEN" a user asks "What is a deductible in insurance?"
- **AND** neither quote nor clauses answer this
- **THEN** the chat uses general knowledge
- **AND" clearly labels it as "General insurance knowledge"

### Requirement: Never respond with "I don't have information" when quote data exists
The system SHALL always provide an answer based on available quote data before stating lack of information.

#### Scenario: User asks about coverage details
- **WHEN" a user asks about a coverage present in the quote
- **AND** RAG retrieval fails
- **THEN** the chat still answers using quote data
- **AND" never says "I don't have information" for data that exists in the quote

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Prioritize quote data as primary source
The system SHALL use extracted quote data as the primary source for chat responses, with clause documents and general knowledge as secondary sources.

#### Scenario: Answer deductible question with quote data
- **WHEN" a user asks "What are CHUBB's deductibles?"
- **THEN** the chat first searches the extracted quote data
- **AND** responds with: "According to CHUBB's quote: AMPARO BÁSICO has 10% deductible with minimum 5 SMMLV"
- **AND" includes a disclaimer: "Based on quote data, not clause document"

### Requirement: Fallback to structured clauses
The system SHALL search structured clause documents when quote data is insufficient.

#### Scenario: Detailed clause question
- **WHEN" a user asks "What exclusions apply to CHUBB's earthquake coverage?"
- **AND** the quote data doesn't list exclusions
- **THEN** the chat searches structured clause database
- **AND" responds with specific exclusions from clause document

### Requirement: Use general knowledge as last resort
The system SHALL use general insurance knowledge only when neither quote data nor clauses provide an answer.

#### Scenario: General insurance question
- **WHEN" a user asks "What is a deductible in insurance?"
- **AND** neither quote nor clauses answer this
- **THEN** the chat uses general knowledge
- **AND" clearly labels it as "General insurance knowledge"

### Requirement: Never respond with "I don't have information" when quote data exists
The system SHALL always provide an answer based on available quote data before stating lack of information.

#### Scenario: User asks about coverage details
- **WHEN" a user asks about a coverage present in the quote
- **AND** RAG retrieval fails
- **THEN** the chat still answers using quote data
- **AND" never says "I don't have information" for data that exists in the quote

## Delta from change: fix-quote-clause-extraction

## MODIFIED Requirements

### Requirement: Fallback to structured clauses
The system SHALL search structured clause documents using corrected Supabase views and tables when quote data is insufficient.

#### Scenario: Detailed clause question
- **WHEN** a user asks "What exclusions apply to CHUBB's earthquake coverage?"
- **AND** the quote data doesn't list exclusions
- **THEN** the chat searches the corrected `document_insurer_view` and `chunks` table
- **AND** returns RAG evidence successfully without database or column errors
- **AND** the search uses a minimum similarity threshold of 0.62
