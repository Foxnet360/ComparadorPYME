## MODIFIED Requirements

### Requirement: Fallback to structured clauses
The system SHALL search structured clause documents using corrected Supabase views and tables when quote data is insufficient.

#### Scenario: Detailed clause question
- **WHEN** a user asks "What exclusions apply to CHUBB's earthquake coverage?"
- **AND** the quote data doesn't list exclusions
- **THEN** the chat searches the corrected `document_insurer_view` and `chunks` table
- **AND** returns RAG evidence successfully without database or column errors
- **AND** the search uses a minimum similarity threshold of 0.62
