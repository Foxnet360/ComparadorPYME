## Capability

Análisis de condiciones de cumplimiento (garantías/warranties) del clausulado, clasificadas por tipo (documental, operacional, técnica, financiera) y dificultad de cumplimiento. Calcula el riesgo de incumplimiento basado en el perfil del cliente.

## User Story

**Como** corredor de seguros
**Quiero** entender qué tan difícil será para mi cliente cumplir las condiciones de la póliza
**Para** prevenir siniestros no cubiertos por incumplimiento de garantías

## Functional Requirements

### FR-1: Clasificación de condiciones

El sistema DEBE clasificar cada condición del clausulado por tipo y dificultad.

#### Scenario: Condición documental fácil
- **WHEN** la condición es "Presentar certificado de bomberos vigente"
- **THEN** tipo = **DOCUMENTAL**
- **AND** dificultad = **EASY**
- **AND** riesgo de incumplimiento = **LOW**

#### Scenario: Condición técnica media
- **WHEN** la condición es "Mantener sistema de alarma conectado a central 24/7"
- **THEN** tipo = **TECNICO**
- **AND** dificultad = **MEDIUM**
- **AND** riesgo de incumplimiento = **MEDIUM**

#### Scenario: Condición financiera difícil
- **WHEN** la condición es "Constituir fianza de cumplimiento del 20% del valor asegurado"
- **THEN** tipo = **FINANCIERO**
- **AND** dificultad = **HARD**
- **AND** riesgo de incumplimiento = **HIGH**

### FR-2: Dashboard de cumplimiento

El sistema DEBE mostrar un resumen visual del riesgo de incumplimiento por tipo de condición.

#### Scenario: Dashboard completo
- **WHEN** se analizan las garantías de una póliza
- **THEN** se muestra:
  - Documentales: 3/5 cumplidas (60%) 🟡
  - Operacionales: 2/2 cumplidas (100%) 🟢
  - Técnicas: 2/5 cumplidas (40%) 🔴
  - Financieras: 1/3 cumplidas (33%) 🔴

### FR-3: Riesgo de incumplimiento

El sistema DEBE calcular el riesgo general de incumplimiento considerando todas las condiciones.

#### Scenario: Riesgo alto
- **WHEN** más del 30% de condiciones tienen riesgo HIGH
- **THEN** riesgo general = **HIGH**
- **AND** alerta: "Alto riesgo de incumplimiento. Considerar negociar condiciones financieras."

## Dependencies
- `contextual-risk-analysis`: Requiere perfil del cliente
- `clause-coverage-validation`: Requiere garantías extraídas del clausulado

## Data Model

```typescript
interface WarrantyCondition {
  text: string;
  type: 'DOCUMENTAL' | 'OPERACIONAL' | 'TECNICO' | 'FINANCIERO';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  complianceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  verificationMethod: string;
  estimatedCost?: number;
}

interface WarrantyComplianceSummary {
  totalConditions: number;
  byType: {
    documental: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    operacional: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    tecnico: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
    financiero: { count: number; compliant: number; risk: 'LOW' | 'MEDIUM' | 'HIGH' };
  };
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  highRiskConditions: WarrantyCondition[];
}
```

## API

```
POST /api/analysis/warranty-compliance
Request:
{
  quoteId: string,
  clauseDocumentId: string,
  clientProfile: ClientProfile
}

Response:
{
  summary: WarrantyComplianceSummary,
  conditions: WarrantyCondition[],
  recommendations: string[]
}
```
