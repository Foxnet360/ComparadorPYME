## ADDED Requirements

### Requirement: Cross-encoder reranking of retrieved chunks
The system SHALL apply reranking to clause chunks retrieved via vector search to improve relevance and reduce hallucinations.

#### Scenario: Retrieve and rerank chunks
- **WHEN** the system retrieves 15 chunks for coverage "Incendio"
- **THEN** it SHALL apply similarity score threshold of 0.7 to filter low-relevance chunks
- **AND** boost chunks with exact coverage_tags match by +0.15 score
- **AND** return the top 5 most relevant chunks after reranking

#### Scenario: No chunks above threshold
- **WHEN** all retrieved chunks have similarity < 0.7
- **THEN** the system SHALL return an empty array
- **AND** log a warning: "No chunks above relevance threshold for [coverage]"

### Requirement: Anti-hallucination prompt instructions
The system SHALL include explicit anti-hallucination instructions in all RAG prompts.

#### Scenario: LLM prompt with constraints
- **WHEN** generating a cross-reference response using retrieved chunks
- **THEN** the prompt SHALL include: "Use ONLY the information in the provided context. If the context does not contain the answer, respond 'No encontrado en cláusulas'."
- **AND** the prompt SHALL include: "Do NOT infer or calculate values not explicitly stated in the context."

### Requirement: Score threshold configuration
The system SHALL support configurable minimum relevance scores for chunk retrieval.

#### Scenario: Default threshold
- **WHEN** no custom threshold is configured
- **THEN** the system uses minimum similarity score of 0.7

#### Scenario: Custom threshold
- **WHEN** an administrator configures threshold = 0.8
- **THEN** only chunks with similarity >= 0.8 are returned
