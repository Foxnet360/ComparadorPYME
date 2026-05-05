## Capability

Detección de coberturas obligatorias en el clausulado que fueron omitidas en la cotización. Análisis inverso que parte del clausulado para verificar completitud de la cotización.

## User Story

**Como** corredor de seguros
**Quiero** detectar coberturas que el clausulado establece como obligatorias pero la cotización omite
**Para** asegurar que la póliza contratada cumpla con el mínimo contractual

## Functional Requirements

### FR-1: Extracción de coberturas del clausulado

El sistema DEBE extraer todas las coberturas mencionadas en el clausulado, clasificándolas por obligatoriedad.

#### Scenario: Coberturas extraídas
- **WHEN** se procesa un clausulado
- **THEN** se extraen:
  - Coberturas obligatorias: Incendio, RC, Lucro Cesante
  - Coberturas opcionales: Transporte de Valores, Vidrios Planos

### FR-2: Verificación inversa

El sistema DEBE comparar las coberturas del clausulado contra las de la cotización.

#### Scenario: Cobertura obligatoria faltante
- **WHEN** el clausulado establece "Lucro Cesante" como obligatoria
- **AND** la cotización no la incluye
- **THEN** alerta **CRITICAL**: "Cobertura obligatoria omitida. El clausulado establece Lucro Cesante como cobertura mínima."

#### Scenario: Cobertura opcional faltante
- **WHEN** el clausulado menciona "Transporte de Valores" como opcional
- **AND** la cotización no la incluye
- **THEN** info: "Cobertura opcional no contratada"

## Dependencies
- `clause-coverage-validation`: Base de validación de coberturas

## Data Model

```typescript
interface InverseCoverageCheck {
  coverageName: string;
  isMandatory: boolean;
  existsInClause: boolean;
  existsInQuote: boolean;
  status: 'PRESENT' | 'MANDATORY_MISSING' | 'OPTIONAL_MISSING';
  alertLevel?: 'CRITICAL' | 'INFO';
  clauseReference?: string;
}
```

## API

```
POST /api/analysis/inverse-check
Request:
{
  quoteId: string,
  clauseDocumentId: string
}

Response:
{
  results: InverseCoverageCheck[],
  mandatoryMissingCount: number,
  optionalMissingCount: number
}
```
