# domain-taxonomy Specification

## Purpose
Define the multi-line domain taxonomy registry, category definitions, and fallback rules for the domain-aware comparison platform (`pyme`, `autos`).

## Requirements

### Requirement: Domain Taxonomy Registry
The `DomainTaxonomyRegistry` SHALL load domain taxonomy configurations for supported insurance lines (`pyme`, `autos`) from `data/domains/<domain>/taxonomy.json`.

#### Scenario: PYME Domain Taxonomy
- GIVEN the domain is set to `pyme`
- WHEN taxonomy categories are requested
- THEN the registry SHALL return the 14 standard PYME coverage categories.

#### Scenario: Autos Domain Taxonomy
- GIVEN the domain is set to `autos`
- WHEN taxonomy categories are requested
- THEN the registry SHALL return the specific categories for auto insurance (Responsabilidad Civil, Pérdida Total/Parcial por Daños/Hurto, Asistencia en Viaje, Vehículo de Reemplazo, etc.).

#### Scenario: Fallback Domain Resolution
- GIVEN an unknown or undefined domain parameter is provided
- WHEN resolving the insurance domain
- THEN the system SHALL default to `pyme` with a log warning, ensuring 100% backward compatibility.

### Requirement: Domain-Aware Pipeline Contract
All core pipeline components (`quoteScorer`, `flatTableParser`, `matrixTransformer`, `coverageOntology`, `learningEngine`, `documentIndexingService`) SHALL accept an optional `domain` parameter (type `InsuranceDomain = 'pyme' | 'autos'`) defaulting to `'pyme'`.

#### Scenario: Scoring and Matrix Domain Adaptation
- GIVEN a quote comparison request with `domain: 'autos'`
- WHEN scoring quotes or building flat/matrix tables
- THEN the scoring rules, weights, canonical coverage ordering, and section headers SHALL adapt dynamically to the `autos` domain.

#### Scenario: Learning Loop Domain Isolation
- GIVEN user corrections or ontology mappings recorded for `domain: 'autos'`
- WHEN querying similar corrections or updating the semantic graph
- THEN corrections and learnings SHALL be isolated by `domain` to prevent cross-line contamination between `autos` and `pyme`.

### Requirement: Frontend Domain Selector
The frontend upload interface SHALL provide a `DomainSelector` component allowing users to choose the target insurance domain (`pyme` vs `autos`) prior to uploading quotes.

#### Scenario: Default Selection and Parameter Transmission
- GIVEN the user visits the quote comparison upload screen
- WHEN selecting an insurance domain (default `pyme`)
- THEN the chosen domain SHALL be transmitted in the `/api/analyze` request payload.
