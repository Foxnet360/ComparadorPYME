## MODIFIED Requirements

### FR-5: Support filtered retrieval by insurer
The system SHALL support retrieving clause chunks from a specific insurer only, querying the correct table schema.

#### Scenario: Filter by specific insurer with correct table
- **WHEN** retrieval is requested for insurer "AXA COLPATRIA"
- **THEN** the system SHALL query the `clause_chunks` table for `insurer_name` match
- **AND** if `clause_chunks` is empty, fallback to `documents` table joined with `chunks`
- **AND** results SHALL only include chunks from AXA COLPATRIA documents

#### Scenario: Pre-flight check uses correct schema
- **WHEN** checking if an insurer has indexed clauses
- **THEN** the system SHALL query `clause_chunks` table for `insurer_name`
- **AND** NOT query `chunks` table which lacks the `insurer_name` column
- **AND** return false gracefully if the table is empty without throwing errors

## ADDED Requirements

### Requirement: Handle empty clause_chunks table gracefully
The system SHALL handle the case where `clause_chunks` table exists but has no data.

#### Scenario: Empty clause_chunks with documents available
- **WHEN** `clause_chunks` has 0 rows but `documents` table has clause documents
- **THEN** the pre-flight check SHALL return true (clauses exist in documents)
- **AND** log a warning that chunks need to be generated

#### Scenario: Truly no clauses available
- **WHEN** both `clause_chunks` and `documents` tables have no clause data for the insurer
- **THEN** the system SHALL skip RAG enrichment for that insurer
- **AND** continue with quote-based analysis
