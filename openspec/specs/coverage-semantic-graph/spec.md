# Spec: Coverage Semantic Graph

## Capability
Grafo probabilístico que vincula términos crudos de cobertura, alias de aseguradoras, categorías canónicas, deducibles y reglas de descomposición, y que aprende de correcciones humanas para mejorar el mapeo semántico.

## User Story
**Como** sistema de normalización de coberturas
**Quiero** disponer de un grafo semántico que mejore el mapeo, descomponga coberturas compuestas y vincule deducibles
**Para** reducir la intervención manual del analista y aprender de sus correcciones

## ADDED Requirements

### Requirement: Build and query a coverage semantic graph

The system SHALL maintain a probabilistic graph linking raw terms, insurer aliases, canonical categories, deductibles, and decomposition rules.

#### Scenario: Graph-based coverage mapping

- **GIVEN** the raw term "Daño Material Todo Riesgo"
- **WHEN** the graph is queried
- **THEN** the system SHALL return ranked mappings:
  - `incendio-edificio-contenidos`: 0.92
  - `equipo-electronico`: 0.45
- **AND** include edge provenance (`alias`, `thesaurus`, `learned`)

#### Scenario: Composite coverage decomposition

- **GIVEN** the raw coverage "Amparo Básico Todo Riesgo"
- **WHEN** the graph contains a decomposition rule
- **THEN** the system SHALL emit implicit coverages `incendio`, `terremoto`, `huelga-motin-asonada`
- **AND** mark each with confidence and `isImplicit: true`

#### Scenario: Deductible linking via graph

- **GIVEN** a deductible text and a canonical coverage
- **WHEN** the graph is queried for deductible applicability
- **THEN** the system SHALL return `appliesTo` coverage IDs and a confidence score
- **AND** prefer template-specific rules when available

### Requirement: Learn corrections into the graph

The system SHALL write analyst corrections into the semantic graph as weighted edges or aliases.

#### Scenario: Correction creates learned edge

- **GIVEN** an analyst maps raw name "Daño Material Global" to `incendio-edificio-contenidos`
- **WHEN** the correction is saved
- **THEN** the system SHALL add a learned edge with weight based on correction frequency
- **AND** increment the graph edge confidence for future queries

## Data Contracts

### Coverage Semantic Graph (simplified)

```json
{
  "nodes": [
    { "id": "raw:daño-material-global", "type": "raw_term" },
    { "id": "cat:incendio-edificio-contenidos", "type": "canonical_category" },
    { "id": "alias:bbva-dmg", "type": "insurer_alias", "insurer": "BBVA" }
  ],
  "edges": [
    { "from": "raw:daño-material-global", "to": "cat:incendio-edificio-contenidos", "type": "learned", "weight": 0.85, "correctionCount": 12 },
    { "from": "alias:bbva-dmg", "to": "raw:daño-material-global", "type": "alias", "weight": 1.0 }
  ]
}
```

### Normalized Coverage Output

```json
{
  "canonicalId": "incendio-edificio-contenidos",
  "status": "present",
  "insuredAmount": "$500,000,000",
  "deductible": { "percentage": 10, "minAmount": 6500000, "maxAmount": 65000000 },
  "premium": "$1,200,000",
  "confidence": 0.92,
  "graphConfidence": 0.85,
  "matchMethod": "thesaurus",
  "isImplicit": false,
  "parentRawName": null
}
```

## Error Handling

| Failure | Expected Behavior |
|---------|-------------------|
| Graph query returns no results | Use existing thesaurus/embedding/LLM pipeline; mark `graphConfidence: null`. |
| Graph decomposition ambiguity | Emit all candidates with confidence; flag for analyst review when top-two confidence gap < 0.15. |
| Correction persistence failure | Retry once; on repeated failure, queue correction and alert operators. |

## Dependencies

- Supabase/Redis storage for graph edges.
- Existing thesaurus/ontology for cold-start seeding.
