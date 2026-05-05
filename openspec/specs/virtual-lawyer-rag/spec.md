## Capability

Generación de opiniones legales enriquecidas usando RAG (Retrieval Augmented Generation) que combina la cotización, el clausulado relevante, y el perfil del cliente para proporcionar análisis jurídico personalizado.

## User Story

**Como** corredor de seguros
**Quiero** recibir un análisis legal personalizado de cada cotización
**Para** identificar puntos de negociación y riesgos contractuales específicos para mi cliente

## Functional Requirements

### FR-1: Generación de opinión legal

El sistema DEBE generar una opinión legal para cada cobertura crítica, considerando cotización, clausulado, y perfil del cliente.

#### Scenario: Opinión sobre cobertura suficiente
- **WHEN** el cliente es manufacturero con 150 empleados
- **AND** la cotización ofrece RC por $500M
- **THEN** la opinión legal indica:
  - "Para un manufacturero de alimentos con 150 empleados, el límite de RC de $500M puede ser insuficiente. Casos de contaminación alimentaria en Colombia han excedido $1.000M."

#### Scenario: Opinión sobre exclusión problemática
- **WHEN** el clausulado excluye "falla de proveedor único"
- **AND** el cliente depende de un solo proveedor
- **THEN** la opinión legal indica:
  - "Esta exclusión representa un riesgo crítico dado que el cliente depende de un único proveedor. Se recomienda negociar eliminación o contratar cobertura de cadena de suministro."

### FR-2: Puntos de negociación

El sistema DEBE identificar puntos específicos de negociación con la aseguradora.

#### Scenario: Deducible negociable
- **WHEN** el deducible de terremoto es 20%
- **AND** el mercado promedio es 10-15%
- **THEN** punto de negociación: "Solicitar reducción de deducible de terremoto de 20% a 15%"

### FR-3: Evidencia de clausulado

La opinión legal DEBE incluir citas específicas del clausulado como fundamentación.

#### Scenario: Opinión con cita
- **WHEN** se genera opinión sobre exclusión de construcción adyacente
- **THEN** se incluye cita: "Art. 5.3: 'No se cubren daños causados por obras civiles en inmuebles colindantes'"
- **AND** se indica página y sección del clausulado

## Dependencies
- `contextual-risk-analysis`: Requiere perfil del cliente y exclusiones contextualizadas
- `rag-audit-enrichment`: Requiere sistema de evidencias RAG
- `clause-coverage-validation`: Requiere validación de coberturas

## Data Model

```typescript
interface LegalOpinion {
  coverageName: string;
  riskScenario: string;
  clauseInterpretation: string;
  recommendation: string;
  negotiationPoints: NegotiationPoint[];
  citations: ClauseCitation[];
  confidence: number;
}

interface NegotiationPoint {
  point: string;
  rationale: string;
  expectedOutcome: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface ClauseCitation {
  text: string;
  section: string;
  pageNumber: number;
  documentName: string;
}
```

## API

```
POST /api/analysis/legal-opinion
Request:
{
  quoteId: string,
  coverageNames: string[],
  clientProfile: ClientProfile
}

Response:
{
  opinions: LegalOpinion[],
  highPriorityPoints: NegotiationPoint[],
  overallRiskAssessment: string
}
```
