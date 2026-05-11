# Spec: Premium Breakdown Extraction

## Capability
Extracción detallada del desglose de primas incluyendo prima neta, gastos, impuestos, cargos adicionales y total a pagar, así como primas individuales por cobertura cuando están disponibles.

## User Story
**Como** analista técnico
**Quiero** comparar no solo la prima total sino también primas por cobertura
**Para** identificar qué aseguradora cobra más por cada cobertura específica

## ADDED Requirements

### Requirement: Extract complete premium breakdown
The system SHALL extract all premium components from the PDF.

#### Scenario: Standard premium breakdown
- **WHEN** a PDF shows prima desglosada
- **THEN** the system SHALL extract:
  - netPremium: valor de la prima neta
  - fees: gastos de expedición/emisión
  - taxes: IVA u otros impuestos
  - otherCharges: asistencia, emisión digital, etc.
  - totalPayable: total a pagar (suma de todos)
  - currency: COP o USD
  - periodicity: ANUAL, SEMESTRAL, etc.

#### Scenario: Simple premium
- **WHEN** a PDF only shows "Prima Total" without desglose
- **THEN** totalPayable SHALL be extracted
- **AND** netPremium SHALL equal totalPayable
- **AND** fees, taxes, otherCharges SHALL be 0

#### Scenario: Prima with IVA
- **WHEN** a PDF shows "Prima antes de IVA" and "IVA" separately
- **THEN** netPremium SHALL be "Prima antes de IVA"
- **AND** taxes SHALL be IVA amount
- **AND** totalPayable SHALL be "Prima Total"

### Requirement: Extract per-coverage premiums
The system SHALL extract individual premiums for each coverage when available.

#### Scenario: SBS-style per-coverage premiums
- **WHEN** a PDF shows primas individuales por cobertura (ej: "Todo riesgo daños materiales - PRIMA $485,151")
- **THEN** each coverage in rawCoverages SHALL include its premium
- **AND** the sum of coverage premiums SHOULD approximate netPremium

#### Scenario: No per-coverage premiums
- **WHEN** a PDF does not show primas por cobertura
- **THEN** premium field for each coverage SHALL be null
- **AND** comparison SHALL use only totalPayable

### Requirement: Validate premium consistency
The system SHALL verify that premium components are mathematically consistent.

#### Scenario: Valid breakdown
- **WHEN** netPremium + fees + taxes + otherCharges ≈ totalPayable (±1%)
- **THEN** premium SHALL be marked as valid
- **AND** confidence SHALL be 95%

#### Scenario: Inconsistent breakdown
- **WHEN** sum of components does not equal totalPayable
- **THEN** a warning flag SHALL be added: "Desglose de prima inconsistente"
- **AND** confidence SHALL be reduced to 70%

#### Scenario: Per-coverage sum validation
- **WHEN** per-coverage premiums exist
- **THEN** their sum SHOULD approximate netPremium
- **AND** if difference > 10%, flag as "Primas por cobertura no cuadran con prima neta"

## Dependencies
- `multimodal-pdf-extraction` for raw premium data
