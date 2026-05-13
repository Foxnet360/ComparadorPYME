# Spec: RAG Reranking

## Capability
Score-based reranking of retrieved clause chunks with configurable minimum similarity threshold and coverage tag boosting.

## User Story
**Como** sistema de análisis
**Quiero** filtrar chunks irrelevantes y priorizar los más relevantes
**Para** reducir alucinaciones en el análisis

## Functional Requirements

### FR-1: Configurable minimum relevance score
The system SHALL support configurable minimum similarity scores for chunk retrieval.

#### Scenario: Default threshold
- **WHEN** no custom threshold is configured
- **THEN** the system uses minimum similarity score of 0.7

#### Scenario: Below threshold
- **WHEN** retrieved chunks have similarity < 0.7
- **THEN** they are excluded from results
- **AND** the system returns empty array if no chunks meet threshold

#### Scenario: Custom threshold
- **WHEN** an administrator configures threshold = 0.8
- **THEN** only chunks with similarity >= 0.8 are returned

### FR-2: Coverage tag boosting
The system SHALL boost chunks that match exact coverage tags.

#### Scenario: Exact coverage match
- **WHEN** a chunk has coverage_tags containing "incendio"
- **AND** the search is for "Incendio"
- **THEN** the chunk's score is boosted by +0.15

#### Scenario: Partial coverage match
- **WHEN** a chunk has related coverage_tags (e.g., "daños materiales")
- **AND** the search is for "Incendio"
- **THEN** no boost is applied

### FR-3: Result limiting after filtering
The system SHALL limit results after applying score thresholds.

#### Scenario: Initial retrieval
- **WHEN** the system retrieves 15 chunks initially
- **THEN** all chunks are scored and filtered by minimum threshold
- **AND** the top 5 most relevant chunks are returned

#### Scenario: No chunks above threshold
- **WHEN** all retrieved chunks have similarity < 0.7
- **THEN** the system SHALL return an empty array
- **AND** log a warning: "No chunks above relevance threshold for [coverage]"

## Dependencies
- RAG retrieval service
- Supabase vector search
- Coverage tag extraction