## Capability

Contextualización de exclusiones del clausulado según el perfil específico del cliente (industria, ubicación, tipo de edificio, etc.). Transforma exclusiones genéricas en riesgos personalizados.

## User Story

**Como** corredor de seguros
**Quiero** entender qué exclusiones representan un riesgo real para mi cliente específico
**Para** negociar coberturas adicionales o eliminación de exclusiones críticas

## Functional Requirements

### FR-1: Perfil de cliente

El sistema DEBE almacenar y utilizar el perfil del cliente para contextualizar riesgos.

#### Scenario: Perfil completo
- **WHEN** el cliente tiene perfil completo:
  - Industria: Manufactura
  - Ubicación: Cartagena (zona costera)
  - Edificio: Arrendado
  - Proveedores: Único proveedor clave
- **THEN** el sistema usa estos datos para contextualizar exclusiones

#### Scenario: Perfil incompleto
- **WHEN** el cliente no tiene perfil completo
- **THEN** se usa análisis genérico (comportamiento actual)
- **AND** se muestra sugerencia: "Complete el perfil del cliente para análisis personalizado"

### FR-2: Contextualización de exclusiones

El sistema DEBE evaluar cada exclusión del clausulado contra el perfil del cliente y asignar un nivel de riesgo contextualizado.

#### Scenario: Exclusión de inundación en zona costera
- **WHEN** el clausulado excluye "daños por inundación"
- **AND** el cliente está en Cartagena
- **THEN** riesgo contextualizado = **CRITICAL**
- **AND** explicación: "El cliente está en zona costera con alta probabilidad de inundaciones. Esta exclusión deja desprotegido un riesgo mayor."

#### Scenario: Exclusión de inundación en zona montañosa
- **WHEN** el clausulado excluye "daños por inundación"
- **AND** el cliente está en Bogotá (zona montañosa)
- **THEN** riesgo contextualizado = **LOW**
- **AND** explicación: "El cliente está en zona montañosa con baja probabilidad de inundaciones. Esta exclusión tiene impacto limitado."

### FR-3: Sugerencias de mitigación

El sistema DEBE sugerir acciones para mitigar riesgos identificados.

#### Scenario: Riesgo crítico con mitigación disponible
- **WHEN** una exclusión tiene riesgo **CRITICAL**
- **THEN** se sugiere:
  1. Negociar eliminación de exclusión
  2. Contratar cobertura adicional específica
  3. Costo estimado de la cobertura adicional

## Dependencies
- `clause-coverage-validation`: Requiere exclusiones extraídas del clausulado
- `rag-audit-enrichment`: Integración con sistema de alertas enriquecidas

## Data Model

```typescript
interface ClientProfile {
  industryType: 'manufactura' | 'comercio' | 'servicios' | 'construccion' | 'transporte' | 'otro';
  locationCity: string;
  locationZone: 'costera' | 'montana' | 'urbana' | 'industrial' | 'rural';
  hasSingleSupplier: boolean;
  employeeCount: number;
  buildingType: 'propio' | 'arrendado' | 'mixto';
  primaryActivity: string;
  annualRevenue?: number;
}

interface ContextualizedExclusion {
  exclusion: string;
  baseRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  contextualRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  explanation: string;
  mitigationSuggestions: string[];
  estimatedAdditionalCost?: string;
}
```

## API

```
POST /api/analysis/contextualize
Request:
{
  analysisId: string,
  clientProfile: ClientProfile
}

Response:
{
  exclusions: ContextualizedExclusion[],
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number
}
```
