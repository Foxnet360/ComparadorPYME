# Spec: Deterministic Quote Parser

## Capability
Parser determinístico local que convierte salida de texto libre de Gemini en datos estructurados de cotizaciones usando regex y normalización con thesaurus.

## User Story
**Como** sistema de análisis
**Quiero** extraer datos estructurados de la respuesta de texto de Gemini
**Para** evitar problemas de truncamiento de JSON

## Functional Requirements

### FR-1: Regex-based text parsing
The system SHALL parse Gemini's text output using deterministic regex patterns to extract structured data.

#### Scenario: Extracting insurer name
- **WHEN** Gemini output contains "ASEGURADORA: HDI SEGUROS COLOMBIA S.A."
- **THEN** the parser extracts "HDI SEGUROS COLOMBIA S.A."
- **AND** stores it in the insurerName field

#### Scenario: Extracting coverages
- **WHEN** Gemini output contains a list of coverages with values and deductibles
- **THEN** the parser extracts each coverage as a structured object
- **AND** handles variations in formatting (bullets, numbers, indentation)

#### Scenario: Handling missing sections
- **WHEN** a section like "CONDICIONES ESPECIALES" is missing from the output
- **THEN** the parser continues without error
- **AND** sets that section to empty array or null

### FR-2: Thesaurus normalization
The system SHALL normalize extracted coverage names using the existing thesaurus.

#### Scenario: Known synonym match
- **WHEN** the parser extracts "Inmuebles y mejoras locativas"
- **THEN** the thesaurus matches it to "Incendio (Edificio y Contenidos)"
- **AND** stores both the raw name and the canonical name

#### Scenario: Partial match
- **WHEN** the parser extracts "Seguro de Incendio para Edificios"
- **THEN** the thesaurus finds partial match with "Incendio (Edificio y Contenidos)"
- **AND** stores the canonical name with confidence score

#### Scenario: No match found
- **WHEN** the parser extracts a coverage not in the thesaurus
- **THEN** the system stores the raw name
- **AND** flags it for manual review and thesaurus update

### FR-3: Parser confidence scoring
The system SHALL assign confidence scores to parsed fields.

#### Scenario: High confidence
- **WHEN** a field matches expected pattern exactly
- **THEN** confidence is 95-100%

#### Scenario: Low confidence
- **WHEN** a field is ambiguous or partially matched
- **THEN** confidence is below 70%
- **AND** the system flags it for review in the analysis

## Dependencies
- Thesaurus de coberturas (thesaurus.json)
- Servicio de normalización de texto
