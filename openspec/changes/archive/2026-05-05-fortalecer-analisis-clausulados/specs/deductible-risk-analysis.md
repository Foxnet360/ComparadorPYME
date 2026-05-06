## Capability

Análisis de riesgo de deducibles considerando la suma asegurada, topes máximos, y proporción del valor asegurado. Detecta deducibles que parecen favorables pero tienen topes restrictivos o representan un porcentaje alto del valor asegurado.

## User Story

**Como** corredor de seguros
**Quiero** entender el riesgo real de los deducibles considerando el valor asegurado
**Para** detectar deducibles aparentemente bajos pero prohibitivos en caso de siniestro

## Functional Requirements

### FR-1: Cálculo de deducible real

El sistema DEBE calcular el monto real del deducible basado en el valor asegurado y las condiciones del clausulado.

#### Scenario: Deducible con tope máximo
- **WHEN** el clausulado establece "10% / Mín. 2 SMMLV / Máx. 500 SMMLV"
- **AND** el valor asegurado es $5.000.000.000
- **THEN** el deducible real es el mínimo entre: 10% de $5B ($500M) y tope de 500 SMMLV (~$500M)
- **AND** el deducible efectivo es ~$500M

#### Scenario: Deducible sin tope
- **WHEN** el clausulado establece "15% sobre valor asegurado"
- **AND** el valor asegurado es $10.000.000.000
- **THEN** el deducible real es $1.500.000.000
- **AND** se genera alerta **WARNING**: "Deducible sin tope máximo representa 15% del valor asegurado"

### FR-2: Proporción de riesgo

El sistema DEBE calcular la proporción del deducible respecto al valor asegurado y clasificar el riesgo.

#### Scenario: Riesgo bajo
- **WHEN** el deducible representa menos del 10% del valor asegurado
- **THEN** riesgo = **LOW**
- **AND** score de deductibles = 80-100

#### Scenario: Riesgo medio
- **WHEN** el deducible representa entre 10% y 15% del valor asegurado
- **THEN** riesgo = **MEDIUM**
- **AND** score de deductibles = 50-79

#### Scenario: Riesgo alto
- **WHEN** el deducible representa más del 15% del valor asegurado
- **THEN** riesgo = **HIGH**
- **AND** score de deductibles = 0-49

### FR-3: Comparativa de deducibles

El sistema DEBE permitir comparar deducibles entre aseguradoras considerando el valor real (no solo el porcentaje).

#### Scenario: Comparativa con valores diferentes
- **WHEN** Aseguradora A ofrece "10% / Máx. 300 SMMLV" sobre $5B
- **AND** Aseguradora B ofrece "15% / Sin tope" sobre $3B
- **THEN** se muestra:
  - A: Deducible real = $300M (6% del valor)
  - B: Deducible real = $450M (15% del valor)

## Dependencies
- `clause-coverage-validation`: Requiere coberturas validadas primero
- `coverage-value-formatting`: Parseo de valores asegurados

## Data Model

```typescript
interface DeductibleAnalysis {
  coverageName: string;
  quoteDeductible: string;
  clauseDeductible: string;
  insuredAmount: number;
  deductibleAmount: number;
  deductibleRatio: number;
  hasCap: boolean;
  capAmount?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
}
```

## API

```
POST /api/analysis/deductible-risk
Request:
{
  quoteId: string,
  coverageName: string,
  deductibleText: string,
  insuredAmount: number
}

Response:
{
  analysis: DeductibleAnalysis,
  alertLevel?: 'CRITICAL' | 'WARNING' | 'INFO',
  recommendation?: string
}
```
