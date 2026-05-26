# Spec: Coverage Preservation

## Capability
Garantizar que todas las coberturas extraídas de un PDF de cotización sean visibles en el navegador del usuario, ya sea mapeadas a categorías canónicas PYME o presentadas como coberturas sin clasificar, evitando pérdida silenciosa de información contractual.

## User Story
**Como** usuario del comparador de cotizaciones
**Quiero** ver todas las coberturas que cada aseguradora ofrece
**Para** tomar decisiones informadas sin perder coberturas importantes que no encajen en categorías predefinidas

## ADDED Requirements

### Requirement: Preserve all extracted coverages
The system SHALL NOT discard any coverage extracted from the PDF unless it is demonstrably invalid (empty name and empty description).

#### Scenario: Coverage without insured amount
- **WHEN** a coverage has a valid name but no insuredAmount or premium
- **THEN** the system SHALL preserve it as uncategorized
- **AND** set status to "present"
- **AND** set confidence to 0
- **AND** flag needsReview as true

#### Scenario: Coverage without deductible
- **WHEN** a coverage has valid name and amount but deductible is null
- **THEN** the system SHALL preserve it
- **AND** set deductible to null
- **AND** apply general deductible if available during post-processing

#### Scenario: Coverage that fails ontology mapping
- **WHEN** a coverage does not match any semantic group in the ontology
- **THEN** the system SHALL preserve it as uncategorized
- **AND** display the raw name to the user
- **AND** set matchMethod to null

### Requirement: Display uncategorized coverages in comparison
The system SHALL render uncategorized coverages in the comparison UI so users can see all coverages offered by each insurer.

#### Scenario: Comparison table with uncategorized
- **WHEN** a quote has uncategorized coverages
- **THEN** the comparison view SHALL display them in a dedicated section
- **AND** indicate they are "Sin clasificar" or "Coberturas adicionales"
- **AND** show raw name, insured amount, and deductible if available

#### Scenario: Detail view with uncategorized
- **WHEN** a user expands a quote detail
- **THEN** uncategorized coverages SHALL be listed after canonical coverages
- **AND** each SHALL show its original name as extracted from PDF

### Requirement: Log coverage loss for debugging
The system SHALL log any coverage that cannot be preserved, with sufficient detail to diagnose the cause.

#### Scenario: Coverage discarded
- **WHEN** a coverage is filtered out for any reason
- **THEN** the system SHALL log a warning with:
  - raw coverage name
  - reason for discard (no value, no premium, invalid schema, etc.)
  - insurer name
  - quote filename

### Requirement: Deductible field is optional in extraction schema
The extraction schema SHALL permit null deductibles to avoid rejecting valid coverages that don't specify a deductible in the PDF.

#### Scenario: Schema accepts null deductible
- **WHEN** Gemini returns a coverage with deductible: null
- **THEN** the schema validation SHALL accept it
- **AND** the coverage SHALL proceed to normalization
- **AND** a general deductible SHALL be applied if available

#### Scenario: Schema still accepts string deductible
- **WHEN** Gemini returns a coverage with deductible: "10% sobre valor asegurado"
- **THEN** the schema validation SHALL accept it
- **AND** the string SHALL be preserved through normalization
