# Spec: Unified Comparison Extraction

## Capability
Motor multimodal que procesa múltiples cotizaciones de seguros simultáneamente en una sola llamada LLM, generando un JSON comparativo estructurado que replica la matriz de comparación del Excel técnico.

## ADDED Requirements

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
- **WHEN** a coverage is offered by only one insurer among the comparison set
- **THEN** the system SHALL mark it as exclusive (`isExclusive: true`)
- **AND** it SHALL place it in a dedicated "Amparos Exclusivos" section
- **AND** all other insurer columns SHALL show "No incluida" / "N.C."

### Requirement: Gemini 3.5 Flash configuration
The system SHALL use Gemini 3.5 Flash with optimal configuration for document comparison tasks.

#### Scenario: Model configuration
- **WHEN** the comparison engine is initialized
- **THEN** it SHALL use model ID `gemini-3.5-flash`
- **AND** it SHALL set `thinkingLevel` to `"MEDIUM"` (default)
- **AND** it SHALL NOT set `temperature`, `top_p`, or `top_k` parameters
- **AND** it SHALL set `responseMimeType` to `"application/json"`
- **AND** it SHALL provide a strict `responseSchema` for structured output

#### Scenario: High complexity fallback
- **WHEN** processing 8 or more quotes, or quotes with complex bundled coverages
- **THEN** the system MAY upgrade `thinkingLevel` to `"HIGH"`
- **AND** it SHALL log the configuration change for monitoring

### Requirement: JSON Schema validation
The system SHALL validate the LLM output against a strict JSON schema before returning it.

#### Scenario: Valid output
- **WHEN** Gemini returns a JSON response
- **THEN** the system SHALL validate it against `UnifiedComparisonResult` schema
- **AND** it SHALL calculate a confidence score (0-1) based on data completeness
- **AND** it SHALL flag `needsHumanReview` if confidence < 0.90

#### Scenario: Invalid or malformed output
- **WHEN** Gemini returns malformed JSON or missing required fields
- **THEN** the system SHALL attempt one retry with a correction prompt
- **AND** if retry fails, it SHALL throw a `ComparisonExtractionError`
- **AND** the adapter SHALL fallback to the legacy engine

## Dependencies
- `gemini-api` for multimodal PDF processing
- `comparison-engine-adapter` for feature flag integration and fallback
