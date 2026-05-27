# Spec: Unified Comparison Extraction

## Capability
Motor multimodal que procesa múltiples cotizaciones de seguros simultáneamente en una sola llamada LLM, generando un JSON comparativo estructurado que replica la matriz de comparación del Excel técnico.

## Requirements

### Requirement: Single-call multimodal comparison
The system SHALL process N quote PDFs in a single Gemini 3.5 Flash API call and generate a structured comparison JSON.

#### Scenario: Successful comparison of 4 quotes
- **WHEN** the system receives 4 quote PDFs (MAPFRE, CHUBB, BBVA, AXA)
- **THEN** it SHALL upload all PDFs to Gemini File API
- **AND** it SHALL make a single generateContent call with all PDFs and the comparison prompt
- **AND** it SHALL return a `UnifiedComparisonResult` JSON within 60 seconds
- **AND** the result SHALL contain all 4 insurers with their coverages, deductibles, and premiums

#### Scenario: Coverage equivalence detection
- **WHEN** one insurer calls a coverage "Amparo Básico" and another "Todo Riesgo Daño Material"
- **THEN** the system SHALL group them under the same category in the comparison matrix
- **AND** it SHALL preserve the original name from each insurer in the `rawText` field
- **AND** it SHALL indicate "Incluido en [parent]" when a coverage is bundled within another

#### Scenario: Deductible structured extraction
- **WHEN** a deductible text reads "10% del valor de la pérdida, mínimo 1 SMMLV"
- **THEN** the system SHALL extract it as a structured object: `{percentage: 10, minimum: 1, currency: "SMMLV", type: "percentage_with_minimum"}`
- **AND** it SHALL flag it as ambiguous (`isAmbiguous: true`) if the text is unclear or incomplete
- **AND** it SHALL use "Ver condiciones" as fallback when the deductible cannot be determined from the quote

#### Scenario: Exclusive coverage detection
- **WHEN** an insurer offers a coverage not present in other quotes
- **THEN** the system SHALL mark it as exclusive in the comparison matrix
- **AND** it SHALL note it in the analysis section as competitive advantage/disadvantage

### Requirement: JSON schema validation
The system SHALL validate the LLM output against a strict JSON schema.

#### Scenario: Valid output
- **WHEN** the LLM returns a JSON matching the schema
- **THEN** the system SHALL accept it and process normally

#### Scenario: Invalid output
- **WHEN** the LLM returns malformed JSON or missing required fields
- **THEN** the system SHALL reject it
- **AND** it SHALL retry with a correction prompt up to 2 times
- **AND** if still invalid, it SHALL fallback to legacy processing

### Requirement: Result caching
The system SHALL cache comparison results for performance.

#### Scenario: Identical files
- **WHEN** the same set of PDFs is uploaded again
- **THEN** the system SHALL return the cached result
- **AND** processing time SHALL be < 1 second

## Dependencies
- `multimodal-pdf-extraction` for PDF upload
- `gemini-model-configuration` for LLM settings
- `coverage-post-normalization` for canonical mapping
