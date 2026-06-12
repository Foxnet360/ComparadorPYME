## ADDED Requirements

### Requirement: Parse compound deductible structures
The system SHALL parse complex deductible expressions including percentages, minimums, maximums, and fixed amounts.

#### Scenario: Parse compound deductible
- **WHEN" the text "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" is found
- **THEN** the system extracts:
  - Component 1: {type: "percentage", value: 10}
  - Component 2: {type: "minimum", value: 5, currency: "SMMLV"}
  - Component 3: {type: "maximum", value: 50, currency: "SMMLV"}
  - Normalized: {minAmount: 6500000, maxAmount: 65000000, percentage: 10}

### Requirement: Handle ambiguous deductible expressions
The system SHALL handle various deductible expressions including "sin aplicación", "Mínimo", "NO APLICA", and regional variants.

#### Scenario: Parse "sin aplicación de deducible"
- **WHEN" the text "sin aplicación de deducible" is found
- **THEN** the system returns:
  - isZero: true
  - components: [{type: "na", value: 0}]
  - normalized: {minAmount: 0, maxAmount: 0, percentage: 0}

### Requirement: Provide deductible benchmarks by risk type
The system SHALL include market benchmarks to evaluate whether a deductible is favorable.

#### Scenario: Evaluate terremoto deductible
- **WHEN" a deductible of "10% min 5 SMMLV" for Terremoto is parsed
- **THEN** the system compares against benchmarks:
  - Market standard: "10% min 5 SMMLV"
  - Evaluation: "Estándar de mercado"
- **AND** for "10% min 2 SMMLV", it flags as "Mejor que el estándar"

### Requirement: Calculate expected deductible cost
The system SHALL calculate the expected annual cost of deductibles based on claim probability and average claim amounts.

#### Scenario: Calculate expected cost
- **WHEN" a deductible structure and risk profile are provided
- **THEN** the system calculates:
  - Expected deductible per claim: min(max(minAmount, percentage * avgClaim), maxAmount)
  - Annual expected cost: expectedDeductible * claimProbability
- **AND** displays this alongside the raw deductible for context

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Parse compound deductible structures
The system SHALL parse complex deductible expressions including percentages, minimums, maximums, and fixed amounts.

#### Scenario: Parse compound deductible
- **WHEN" the text "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" is found
- **THEN** the system extracts:
  - Component 1: {type: "percentage", value: 10}
  - Component 2: {type: "minimum", value: 5, currency: "SMMLV"}
  - Component 3: {type: "maximum", value: 50, currency: "SMMLV"}
  - Normalized: {minAmount: 6500000, maxAmount: 65000000, percentage: 10}

### Requirement: Handle ambiguous deductible expressions
The system SHALL handle various deductible expressions including "sin aplicación", "Mínimo", "NO APLICA", and regional variants.

#### Scenario: Parse "sin aplicación de deducible"
- **WHEN" the text "sin aplicación de deducible" is found
- **THEN** the system returns:
  - isZero: true
  - components: [{type: "na", value: 0}]
  - normalized: {minAmount: 0, maxAmount: 0, percentage: 0}

### Requirement: Provide deductible benchmarks by risk type
The system SHALL include market benchmarks to evaluate whether a deductible is favorable.

#### Scenario: Evaluate terremoto deductible
- **WHEN" a deductible of "10% min 5 SMMLV" for Terremoto is parsed
- **THEN** the system compares against benchmarks:
  - Market standard: "10% min 5 SMMLV"
  - Evaluation: "Estándar de mercado"
- **AND** for "10% min 2 SMMLV", it flags as "Mejor que el estándar"

### Requirement: Calculate expected deductible cost
The system SHALL calculate the expected annual cost of deductibles based on claim probability and average claim amounts.

#### Scenario: Calculate expected cost
- **WHEN" a deductible structure and risk profile are provided
- **THEN** the system calculates:
- Expected deductible per claim: min(max(minAmount, percentage * avgClaim), maxAmount)
  - Annual expected cost: expectedDeductible * claimProbability
- **AND** displays this alongside the raw deductible for context

## Delta from change: fix-quote-clause-extraction

## MODIFIED Requirements

### Requirement: Parse compound deductible structures using Structured Outputs
The system SHALL parse complex deductible expressions including percentages, minimums, maximums, and fixed amounts using Gemini Structured Outputs with a JSON schema.

#### Scenario: Parse compound deductible with responseSchema
- **WHEN** a complex deductible text like "10% con mínimo de 5 SMMLV" is evaluated
- **THEN** the system SHALL invoke Gemini with responseSchema and responseMimeType: "application/json"
- **AND** the extracted components and semantics SHALL conform precisely to the schema

---

## Delta from change: robustez-extraccion-cotizaciones-clausulados

## MODIFIED Requirements

### Requirement: Deterministic Parsing First
The system MUST attempt regex + benchmark table parsing before falling back to LLM for deductible extraction.

#### Scenario: Regex Hit
- **WHEN** the text "10% min 5 SMMLV" is parsed
- **THEN** the regex pattern matches and benchmark tables evaluate the normalized value
- **AND** no LLM call is made.

#### Scenario: LLM Fallback
- **WHEN** the text does not match any known regex pattern
- **THEN** the system falls back to Gemini for parsing
- **AND** the result is cached in Redis with a versioned key.

#### Scenario: Cache Hit
- **WHEN** the same unparseable text is submitted again
- **THEN** Redis returns the cached result
- **AND** no LLM call is made.

### Requirement: Telemetry for Fallback Monitoring
The system SHOULD emit structured logs and counters for cache hits, regex hits, and LLM fallbacks.

#### Scenario: Fallback Rate Telemetry
- **WHEN** the hybrid parser processes multiple deductibles
- **THEN** counters for `cacheHits`, `regexHits`, and `llmFallbacks` are accumulated
- **AND** structured logs are emitted for monitoring.

---

## Delta from change: mejora-extraccion-coberturas

## MODIFIED Requirements

### Requirement: Parse compound deductible structures

The system SHALL parse complex deductible expressions using deterministic regex, template-specific location hints, and graph deductible-applicability rules.

(Previously: parsing used regex and LLM fallback without insurer-template locations or graph rules.)

#### Scenario: Template-specific deductible location

- **GIVEN** a known template places deductible text in column 3
- **WHEN** the system parses deductible cells
- **THEN** it SHALL prefer column 3 text for that template
- **AND** fall back to regex on the full row if column text is empty

#### Scenario: Graph rule determines applicability

- **GIVEN** a deductible text is parsed
- **WHEN** the graph contains an `appliesTo` rule for the current insurer
- **THEN** the system SHALL assign the deductible to the linked coverages
- **AND** include `applicabilityConfidence` in the result

### Requirement: Deterministic Parsing First

The system MUST attempt regex + benchmark table parsing before falling back to LLM for deductible extraction, and SHALL consult graph applicability rules before assigning deductibles to coverages.

(Previously: deterministic parsing did not consult graph applicability rules.)

#### Scenario: Regex and graph rule hit

- **WHEN** the text "10% min 5 SMMLV" is parsed
- **THEN** the regex pattern matches and benchmark tables evaluate the normalized value
- **AND** the graph links the deductible to the applicable coverage
- **AND** no LLM call is made

#### Scenario: LLM Fallback

- **WHEN** the text does not match any known regex pattern
- **THEN** the system falls back to Gemini for parsing
- **AND** the result is cached in Redis with a versioned key
