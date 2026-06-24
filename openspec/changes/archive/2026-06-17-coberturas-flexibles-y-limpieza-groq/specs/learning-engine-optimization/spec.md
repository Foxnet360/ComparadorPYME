## MODIFIED Requirements

### Requirement: Optimized Embedding Generation
The learning engine MUST NOT perform dynamic in-loop embedding generation API calls during similarity evaluation.

#### Scenario: Database-driven similarity
- **GIVEN** a collection of user corrections
- **WHEN** finding similar corrections in the learning engine
- **THEN** the engine SHALL retrieve pre-calculated vector embeddings from the database
- **AND** it MUST NOT call the external embedding API in a loop.

#### Scenario: Local similarity fallback
- **GIVEN** a database without vector extension support
- **WHEN** finding similar corrections
- **THEN** the engine SHALL fallback to a local string similarity algorithm (e.g. Sørensen–Dice)
- **AND** it MUST execute the fallback matching entirely locally.
