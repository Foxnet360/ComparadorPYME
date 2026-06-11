# Domain-Configurable Taxonomy Specification

## Purpose
Enable per-domain loading of taxonomy bundles (thesaurus, ontology, categories) so the system can support insurance lines beyond PYME without code changes.

## Requirements

### Requirement: Load domain taxonomy bundle
The system SHALL load taxonomy data from a per-domain bundle directory when initializing taxonomy services.

#### Scenario: Load PYME default bundle
- **GIVEN** no domain parameter is provided
- **WHEN** a taxonomy service initializes
- **THEN** the system SHALL load the `data/domains/pyme/` bundle
- **AND** produce identical results to current hardcoded behavior

#### Scenario: Load specific domain bundle
- **GIVEN** domain="vivienda"
- **WHEN** a taxonomy service initializes
- **THEN** the system SHALL load the `data/domains/vivienda/` bundle
- **AND** use the categories, ontology, and thesaurus defined in that bundle

### Requirement: Bundle structure validation
The system SHALL validate that a domain bundle contains required files with a shared JSON schema.

#### Scenario: Valid bundle
- **GIVEN** a domain bundle contains `taxonomy.json`, `ontology.json`, and `thesaurus.json`
- **WHEN** the bundle loads
- **THEN** the system SHALL validate each file against the bundle schema
- **AND** initialize services with the validated data

#### Scenario: Missing required file
- **GIVEN** a domain bundle is missing `ontology.json`
- **WHEN** loading is attempted
- **THEN** the system SHALL throw a clear error naming the missing file
- **AND** fallback to the `pyme` bundle

### Requirement: Thread domain through processing pipeline
The system SHALL accept a domain parameter through quote processing and coverage normalization pipelines.

#### Scenario: Domain-aware quote processing
- **GIVEN** a quote request includes domain="auto"
- **WHEN** quoteProcessingService processes the quote
- **THEN** the extraction prompt SHALL use the auto domain taxonomy
- **AND** coverageNormalizer SHALL map to auto canonical categories

#### Scenario: Default domain fallback
- **GIVEN** a quote request omits the domain parameter
- **WHEN** quoteProcessingService processes the quote
- **THEN** domain SHALL default to "pyme"
- **AND** behavior SHALL match current hardcoded PYME pipeline

### Requirement: Bundle isolation
The system SHALL ensure that taxonomy data from one domain does not leak into another domain's processing.

#### Scenario: Concurrent domain requests
- **GIVEN** two simultaneous requests with domain="pyme" and domain="vivienda"
- **WHEN** both requests are processed
- **THEN** each SHALL use its respective domain taxonomy
- **AND** neither SHALL be affected by the other's taxonomy data
