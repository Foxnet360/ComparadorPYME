## ADDED Requirements

### Requirement: Extract structured clause data from PDF
The system SHALL extract insurance clause documents into structured JSON format containing coverages, deductibles, exclusions, conditions, and definitions.

#### Scenario: Successful structured extraction
- **WHEN** a clause PDF is uploaded
- **THEN** the system extracts a JSON structure with all coverages, their descriptions, deductibles, sublimits, exclusions, and conditions
- **AND** each coverage includes the source page number
- **AND** the extraction completes in a single LLM call per document

### Requirement: Store structured clauses in database
The system SHALL store extracted structured clauses in PostgreSQL as JSONB with proper indexing for search.

#### Scenario: Store and retrieve structured clause
- **WHEN** a structured clause is extracted
- **THEN** it is stored in the `structured_clauses` table
- **AND** it can be queried by insurer name, coverage name, or field type
- **AND** GIN indexes enable fast full-text search within the JSON structure

### Requirement: Support both general and particular clauses
The system SHALL support extracting both general clauses (condiciones generales) and particular clauses (condiciones particulares).

#### Scenario: Extract particular clauses
- **WHEN** a particular clause document is uploaded
- **THEN** the system identifies it as particular
- **AND** extracts modifications to general clauses
- **AND** flags differences between general and particular conditions

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Extract structured clause data from PDF
The system SHALL extract insurance clause documents into structured JSON format containing coverages, deductibles, exclusions, conditions, and definitions.

#### Scenario: Successful structured extraction
- **WHEN** a clause PDF is uploaded
- **THEN** the system extracts a JSON structure with all coverages, their descriptions, deductibles, sublimits, exclusions, and conditions
- **AND** each coverage includes the source page number
- **AND** the extraction completes in a single LLM call per document

### Requirement: Store structured clauses in database
The system SHALL store extracted structured clauses in PostgreSQL as JSONB with proper indexing for search.

#### Scenario: Store and retrieve structured clause
- **WHEN** a structured clause is extracted
- **THEN** it is stored in the `structured_clauses` table
- **AND** it can be queried by insurer name, coverage name, or field type
- **AND** GIN indexes enable fast full-text search within the JSON structure

### Requirement: Support both general and particular clauses
The system SHALL support extracting both general clauses (condiciones generales) and particular clauses (condiciones particulares).

#### Scenario: Extract particular clauses
- **WHEN** a particular clause document is uploaded
- **THEN** the system identifies it as particular
- **AND** extracts modifications to general clauses
- **AND** flags differences between general and particular conditions
