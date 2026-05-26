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

### FR-4: Impacto de sublímites en cálculo de deducibles
El sistema DEBE considerar sublímites de cobertura al calcular el riesgo total.

#### Scenario: Cobertura con sublímite bajo
- **WHEN** Incendio tiene valor asegurado de $500M
- **AND** sublímite por evento es $100M
- **THEN** el análisis muestra: "ALERTA: Sublímite por evento ($100M) es 20% del valor asegurado"
- **AND** el riesgo se clasifica como HIGH independientemente del deducible

#### Scenario: Límite agregado excedido
- **WHEN** la suma de valores asegurados excede el límite agregado de la póliza
- **THEN** se genera alerta **CRITICAL**: "Exposición total ($X) excede límite agregado ($Y)"
- **AND** se recomienda: "Solicitar aumento de límite agregado o cobertura adicional"

### FR-5: Seguimiento y visualización de topes
El sistema DEBE rastrear y mostrar explícitamente los topes aplicados a deducibles.

#### Scenario: Información de tope máximo
- **WHEN** un deducible tiene tope máximo
- **THEN** el análisis muestra:
  - Deducible nominal: 20%
  - Tope máximo: 500 SMMLV (~$650M)
  - Deducible efectivo: $500M (porque 20% de $2.5B = $500M < tope)
  - Tope aplicado: No

#### Scenario: Tope aplicado
- **WHEN** un deducible tiene tope máximo que se aplica
- **THEN** el análisis muestra:
  - Deducible nominal: 20%
  - Valor sin tope: $2.000M
  - Tope máximo: 100 SMMLV (~$130M)
  - Deducible efectivo: $130M
  - Tope aplicado: Sí (ahorro de $1.870M vs deducible nominal)
  - Score mejora por aplicación de tope

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

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Analyze compound deductible structures
The system SHALL analyze complex deductible structures with multiple components (percentage, minimum, maximum).

#### Scenario: Analyze compound deductible
- **WHEN" a deductible of "10% con mínimo de 5 SMMLV y tope de 50 SMMLV" is analyzed
- **THEN** the system evaluates each component:
  - Percentage: 10% (standard)
  - Minimum: 5 SMMLV ($6.5M) (elevated)
  - Maximum: 50 SMMLV ($65M) (protective)
- **AND" provides a composite risk assessment

### Requirement: Compare deductibles against market benchmarks
The system SHALL evaluate deductibles against market benchmarks by risk type.

#### Scenario: Benchmark comparison
- **WHEN" analyzing a deductible for "Terremoto"
- **THEN" the system compares against benchmarks:
  - Market standard: 10% min 5 SMMLV
  - Current: 10% min 5 SMMLV
  - Assessment: "Standard market deductible"

### Requirement: Calculate expected deductible cost
The system SHALL calculate the expected annual cost of deductibles.

#### Scenario: Expected cost calculation
- **WHEN" a deductible structure and risk profile are provided
- **THEN** the system calculates expected cost per claim
- **AND** annualizes it based on claim probability

## MODIFIED Requirements

### Requirement: Parse deductible values from text
The system SHALL extract deductible values from text using regex patterns.

#### Scenario: Parse simple deductible
- **WHEN** a deductible text like "10%" or "5 SMMLV" is found
- **THEN** the system extracts the numeric value and type
- **AND" normalizes it to a standard format

### Requirement: Calculate deductible risk score
The system SHALL calculate a risk score for each deductible based on the deductible amount relative to insured value.

#### Scenario: Risk score calculation
- **WHEN** a deductible and insured amount are provided
- **THEN** the system calculates the deductible ratio
- **AND" assigns a risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **AND" generates a recommendation

## REMOVED Requirements

### Requirement: Use simple regex for all deductible parsing
**Reason**: Replaced by semantic parser for compound structures
**Migration**: Use semantic parser for complex deductibles, regex for simple cases only
