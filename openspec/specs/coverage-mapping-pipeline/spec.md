# Spec: Coverage Mapping Pipeline

## Capability
Parallelizes sequential mappings and resolves category ID format mismatches during raw normalization.

## MODIFIED Requirements

### Requirement: Parallelized Coverage Mapping
The coverage normalizer MUST execute raw-to-canonical mappings in parallel with controlled concurrency to prevent sequential database/API delay bottlenecks.

#### Scenario: Parallelized execution
- **GIVEN** a list of raw coverages to normalize
- **WHEN** the normalization pipeline runs
- **THEN** the system SHALL execute the mappings concurrently using a promise pool
- **AND** the concurrency limit MUST NOT exceed 5 concurrent tasks.

### Requirement: Categorization ID Format Alignment
The matcher service MUST resolve discrepancies between numeric taxonomy category IDs and string ontology IDs to align matches correctly.

#### Scenario: Matched ID alignment
- **GIVEN** a numeric category ID from taxonomy and a string ID from ontology
- **WHEN** matching is executed
- **THEN** the service SHALL map category IDs to unified types (e.g. integer) before evaluation
- **AND** it MUST NOT fallback to a default ID of 0.

---

## Delta from change: coberturas-flexibles-y-limpieza-groq

## MODIFIED Requirements

### Requirement: Parallelized Coverage Mapping
The coverage normalizer MUST execute raw-to-canonical mappings in parallel with controlled concurrency to prevent sequential database/API delay bottlenecks.

#### Scenario: Parallelized execution
- **GIVEN** a list of raw coverages to normalize
- **WHEN** the normalization pipeline runs
- **THEN** the system SHALL execute the mappings concurrently using a promise pool
- **AND** the concurrency limit MUST NOT exceed 5 concurrent tasks.

### Requirement: Categorization ID Format Alignment
The matcher service MUST resolve discrepancies between numeric taxonomy category IDs and string ontology IDs to align matches correctly.

#### Scenario: Matched ID alignment
- **GIVEN** a numeric category ID from taxonomy and a string ID from ontology
- **WHEN** matching is executed
- **THEN** the service SHALL map category IDs to unified types (e.g. integer) before evaluation
- **AND** it MUST NOT fallback to a default ID of 0.
