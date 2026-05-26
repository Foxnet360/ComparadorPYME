# Spec: Coverage Cross-Reference

## Capability
Cross-referencing de coberturas de cotizaciones contra cláusulas de aseguradoras usando RAG para detectar discrepancias en deducibles y exclusiones.

## User Story
**Como** usuario del comparador
**Quiero** saber si los deducibles y exclusiones de mi cotización coinciden con las cláusulas de la aseguradora
**Para** tomar una decisión informada

## Functional Requirements

### FR-1: Coverage-based clause retrieval
The system SHALL retrieve relevant clause sections for each coverage found in a quote.

#### Scenario: Matching coverage to clauses
- **WHEN** a quote contains coverage "Incendio (Edificio y Contenidos)"
- **THEN** the system searches clause_chunks for that coverage tag
- **AND** filters by the quote's insurer_name
- **AND** returns the most relevant clause sections

#### Scenario: Cross-insurer clause lookup
- **WHEN** no clauses exist for the quote's insurer
- **THEN** the system falls back to generic clauses from other insurers
- **AND** flags the result as "generic reference, verify with insurer"

### FR-2: Deducible comparison
The system SHALL compare deductibles stated in the quote against those in the clause document.

#### Scenario: Discrepancy detection
- **WHEN** a quote states deducible "5%" for Incendio
- **AND** the clause states deducible "10%" for Incendio
- **THEN** the system generates a CRITICAL alert
- **AND** includes both values in the discrepancy report

#### Scenario: Matching values
- **WHEN** quote and clause deductibles match
- **THEN** no alert is generated
- **AND** the system notes "Verified against clause" in the analysis

### FR-3: Exclusion awareness
The system SHALL identify relevant exclusions from clauses for each coverage.

#### Scenario: Exclusion found
- **WHEN** a quote includes "Robo Mercancías"
- **AND** the clause has exclusion "Mercancías en tránsito no cubiertas"
- **THEN** the system generates a WARNING alert
- **AND** quotes the relevant clause text

#### Scenario: No relevant exclusion
- **WHEN** no exclusions are found for a coverage
- **THEN** the system proceeds without exclusion alerts
- **AND** notes "No exclusions found" in the analysis

## Dependencies
- Servicio de RAG retrieval (clause-rag-indexing)
- Servicio de parsing de cotizaciones (deterministic-quote-parser)

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Cross-reference coverage variables
The system SHALL cross-reference coverage variables (value, deductible, sublimit, exclusions) between quotes and clauses.

#### Scenario: Variable cross-reference
- **WHEN** comparing a quote's "AMPARO BASICO" with clause data
- **THEN" the system checks:
  - Insured amount consistency
  - Deductible agreement
  - Sublimit alignment
  - Exclusion compatibility

### Requirement: Identify discrepancies at variable level
The system SHALL identify discrepancies between quotes and clauses at the variable level.

#### Scenario: Variable discrepancy detection
- **WHEN** a quote states deductible "10%" but clause states "10% min 5 SMMLV"
- **THEN** the system flags the missing minimum as a discrepancy
- **AND" assigns severity based on financial impact

## MODIFIED Requirements

### Requirement: Cross-reference quote coverages with clause documents
The system SHALL verify that quote coverages exist in clause documents.

#### Scenario: Coverage existence check
- **WHEN** a quote includes "Responsabilidad Civil"
- **THEN** the system searches clause documents for this coverage
- **AND" marks it as verified if found
- **OR" flags it as phantom if not found

### Requirement: Detect deductible discrepancies
The system SHALL compare quote deductibles against clause deductibles.

#### Scenario: Deductible comparison
- **WHEN** a quote deductible differs from the clause deductible
- **THEN** the system generates an alert:
  - If quote deductible is lower: "Potentially favorable - verify with insurer"
  - If quote deductible is higher: "Less favorable than standard"

## REMOVED Requirements

### Requirement: Compare only canonical coverage categories
**Reason**: Replaced by variable-level comparison across semantic groups
**Migration**: Compare variables directly rather than forcing canonical categories first
