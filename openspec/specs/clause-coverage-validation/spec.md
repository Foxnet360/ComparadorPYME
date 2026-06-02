## Capability

Validación bidireccional de coberturas entre cotización y clausulado. Asegura que las coberturas ofrecidas en la cotización existan en el clausulado de la aseguradora, y que las coberturas obligatorias del clausulado no estén omitidas en la cotización.

## User Story

**Como** corredor de seguros
**Quiero** verificar que las coberturas ofrecidas en la cotización estén respaldadas por el clausulado de la aseguradora
**Para** evitar ofrecer coberturas "fantasma" que el clausulado no contempla

## Functional Requirements

### FR-1: Validación de existencia (Quote → Clause)

El sistema DEBE verificar que cada cobertura presente en la cotización exista en el clausulado de la aseguradora. Para esto, el sistema DEBE normalizar previamente el nombre de la aseguradora de la cotización usando el servicio de normalización canónico antes de realizar cualquier consulta en la base de datos de clausulados.

#### Scenario: Cobertura verificada
- **WHEN** una cotización incluye "Incendio (Edificio y Contenidos)" para la aseguradora "SBS SEGUROS COLOMBIA S.A."
- **AND** el sistema normaliza el nombre a "SBS" para consultar el clausulado indexado
- **AND** el clausulado de "SBS" menciona esta cobertura
- **THEN** se marca como ✅ **Verificada**

#### Scenario: Cobertura fantasma
- **WHEN** una cotización incluye "Rotura de Maquinaria" para la aseguradora "SBS SEGUROS COLOMBIA S.A."
- **AND** el sistema normaliza el nombre a "SBS" para consultar el clausulado indexado
- **AND** el clausulado de "SBS" NO contempla esta cobertura
- **THEN** se genera alerta **CRITICAL**: "Cobertura ofrecida no contemplada en clausulado"
- **AND** el score de coverage se reduce en 15 puntos por cobertura fantasma

### FR-2: Validación inversa (Clause → Quote)

El sistema DEBE verificar que las coberturas obligatorias del clausulado estén presentes en la cotización.

#### Scenario: Cobertura obligatoria omitida
- **WHEN** el clausulado establece "Responsabilidad Civil (RCE)" como cobertura obligatoria
- **AND** la cotización NO la incluye
- **THEN** se genera alerta **WARNING**: "Cobertura obligatoria omitida en cotización"
- **AND** se incluye referencia al artículo del clausulado

#### Scenario: Cobertura opcional omitida
- **WHEN** el clausulado menciona "Transporte de Valores" como cobertura opcional
- **AND** la cotización no la incluye
- **THEN** se marca como ℹ️ **No contratada** (sin alerta de severidad)

### FR-3: Penalización en scoring

El sistema DEBE penalizar el score cuando el clausulado no está disponible o cuando se detectan coberturas fantasmas. La disponibilidad del clausulado se debe evaluar utilizando el nombre normalizado de la aseguradora.

#### Scenario: Sin clausulado disponible
- **WHEN** no hay clausulado indexado para la aseguradora con nombre normalizado (ej. "SBS")
- **THEN** el score base de coverage se reduce de 50 a 30
- **AND** se muestra advertencia: "Análisis sin validación de clausulado"

#### Scenario: Con coberturas fantasmas
- **WHEN** se detectan 2 coberturas fantasmas
- **THEN** el score de coverage se reduce en 30 puntos (2 × 15)
- **AND** el score mínimo es 0

## Dependencies
- `clause-rag-indexing`: Requiere clausulados indexados en Supabase
- `rag-retrieval`: Búsqueda de chunks relevantes por cobertura
- `semantic-coverage-matching`: Matching de nombres de coberturas (canonicalización)

## Data Model

```typescript
interface CoverageExistenceResult {
  coverageName: string;
  existsInQuote: boolean;
  existsInClause: boolean;
  isMandatory: boolean;
  status: 'VERIFIED' | 'PHANTOM' | 'MANDATORY_MISSING' | 'OPTIONAL_MISSING';
  clauseReference?: string;  // Artículo/sección del clausulado
  alertLevel?: 'CRITICAL' | 'WARNING' | 'INFO';
}
```

## API

```
POST /api/analysis/validate-coverages
Request:
{
  quoteId: string,
  insurerName: string,
  coverageNames: string[]
}

Response:
{
  results: CoverageExistenceResult[],
  phantomCount: number,
  mandatoryMissingCount: number,
  scoreImpact: number
}
```
