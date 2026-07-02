# Delta for unified-comparison-extraction

## MODIFIED Requirements

### Requirement: Single-call multimodal comparison

The system SHALL process N quote PDFs in a single Gemini API call and request a flat comparison table with the rows Bienes Asegurados, Deducibles, Prima con IVA, and Forma de Pago for every insurer.

(Previously: requested a deeply nested canonical schema with 14 coverage categories.)

#### Scenario: Successful comparison of 4 quotes

- GIVEN 4 quote PDFs (MAPFRE, CHUBB, BBVA, AXA)
- WHEN the system uploads all PDFs and calls Gemini with the flat-table prompt
- THEN it SHALL receive a table-formatted response within 60 seconds
- AND the table SHALL contain one row per requested concept and one column per insurer
- AND each cell SHALL contain the raw value as shown in the quote

#### Scenario: Coverage equivalence detection

- GIVEN two insurers use different names for the same concept
- WHEN the flat table is parsed
- THEN the system SHALL preserve each insurer's raw wording in its cell
- AND it SHALL NOT force values into the 14-category ontology

### Requirement: JSON schema validation

The system SHALL validate the LLM output against a flat, table-friendly schema and SHALL fallback to legacy processing after a bounded retry.

(Previously: validated against a strict nested canonical JSON schema.)

#### Scenario: Valid flat output

- GIVEN the LLM returns a parseable flat table
- WHEN the system validates it against the flat schema
- THEN it SHALL accept it and process normally

#### Scenario: Invalid output

- GIVEN the LLM returns malformed or non-tabular output
- WHEN the parser cannot produce a valid flat table
- THEN it SHALL retry with a correction prompt up to 2 times
- AND if still invalid it SHALL return a structured failure to the adapter for legacy fallback

## ADDED Requirements

### Requirement: Flat table parser

The system SHALL parse LLM comparison output as a flat table regardless of whether it is returned as Markdown, CSV, JSON array, or key-value list.

#### Scenario: Markdown table

- GIVEN the LLM returns a Markdown table
- WHEN the parser runs
- THEN it SHALL extract rows, columns, and cells
- AND it SHALL normalize whitespace and delimiters

#### Scenario: CSV-like output

- GIVEN the LLM returns comma-separated values
- WHEN the parser runs
- THEN it SHALL detect separators and quote boundaries
- AND it SHALL map values to insurers and concepts

#### Scenario: Missing or extra rows

- GIVEN the table omits a requested row or adds an unexpected row
- WHEN the parser runs
- THEN it SHALL flag the missing row as `not_found`
- AND it SHALL keep unexpected rows in an `extraRows` array
