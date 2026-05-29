## MODIFIED Requirements

### Requirement: Batch embedding generation
The system SHALL generate embeddings for multiple coverage names in a single API call.

#### Scenario: Batch of 100 coverages
- **WHEN** a quote or clause has up to 100 coverages to normalize
- **THEN** the system SHALL send all names in ONE API call
- **AND** receive up to 100 embeddings in the response
- **AND** the call SHALL complete in < 10 seconds total

#### Scenario: Batch size limit
- **WHEN** a document has more than 100 coverages to process
- **THEN** the system SHALL process them in batches of 100
- **AND** process batches sequentially with a small delay to avoid rate limits
