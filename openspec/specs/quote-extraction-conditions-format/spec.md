# Spec: Quote Extraction - Conditions Format

## Capability
Extracción de coberturas de cotizaciones en formato de condiciones contractuales/descriptivas (tipo Allianz), donde las coberturas aparecen en texto narrativo con bullets en lugar de tablas estructuradas.

## User Story
**Como** sistema de análisis
**Quiero** extraer coberturas de documentos de condiciones de seguro
**Para** analizar cotizaciones de aseguradoras como Allianz que usan formato descriptivo

## Requirements

### Requirement: Detect Conditions format family
The system SHALL detect when a PDF uses the "CONDITIONS" format family.

#### Scenario: Allianz conditions document detection
- **WHEN** extracted text contains "COBERTURA BÁSICA" AND "COBERTURAS ESPECIFICAS Y LIMITES" AND section numbers like "8." or "9."
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 90%
- **AND** set hasSections to true

#### Scenario: General conditions format detection
- **WHEN** extracted text contains narrative descriptions of coverages with bullet points AND "condiciones del contrato" OR "condiciones particulares"
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 85%

### Requirement: Extract coverages from narrative text
The system SHALL extract individual coverages from descriptive paragraphs and bullet lists.

#### Scenario: Extract from bullet points
- **WHEN** the document contains "✓ Incendio y/o rayo o sus efectos inmediatos"
- **THEN** the system SHALL extract coverage: "Incendio y/o rayo o sus efectos inmediatos"
- **AND** infer that it belongs to the "Todo Riesgo Daño Material" basic coverage

#### Scenario: Extract from numbered sections
- **WHEN** section 8 lists "Todo riesgo daño material incluyendo:" followed by bullets
- **THEN** the system SHALL extract each bullet as a separate coverage
- **AND** assign them to the parent coverage "Todo Riesgo Daño Material"

#### Scenario: Extract sub-limits from conditions
- **WHEN** a coverage mentions "sublimitado al X%" or "limitado a $Y"
- **THEN** the system SHALL capture the sub-limit value
- **AND** create a subLimits entry

### Requirement: Handle missing insured amounts
The system SHALL handle cases where individual coverages don't have explicit insured amounts.

#### Scenario: Use total insured value from header
- **WHEN** coverages are listed without individual insured amounts
- **THEN** the system SHALL use the total valor asegurado from the document header
- **AND** distribute it among coverages proportionally or mark as "Total aplicable"

#### Scenario: Mark as included in base coverage
- **WHEN** a bullet says "Incluye incendio, explosión, daños por agua"
- **THEN** the system SHALL mark these as included in the base coverage
- **AND** set insuredAmount to null with note "Incluido en Todo Riesgo"

### Requirement: Extract deductibles from conditions
The system SHALL find deductibles mentioned anywhere in the conditions document.

#### Scenario: Deductible in separate section
- **WHEN** a section mentions "El deducible será del X% del valor del siniestro"
- **THEN** the system SHALL capture this as a general deductible
- **AND** apply it to all property damage coverages

#### Scenario: No deductible specified
- **WHEN** no deductible is mentioned in the conditions document
- **THEN** the system SHALL set deductible to "Ver clausulado"
- **AND** log that deductibles need to be extracted from the clause document

### Requirement: Generate structured output
The system SHALL produce the same QuoteExtractionSchemaV2 output regardless of input format.

#### Scenario: Consistent schema output
- **WHEN** extracting from a CONDITIONS format document
- **THEN** the output SHALL conform to QuoteExtractionSchemaV2
- **AND** include insurerName, policyName, premium, rawCoverages, subLimits, generalDeductibles
- **AND** notes field SHALL explain any inferred values

## Dependencies
- `format-family-detection` for format classification
- `multimodal-pdf-extraction` for PDF vision processing
- `quote-analysis-v2` for schema validation

---

## Delta from change: correccion-cotizacion-allianz

# Spec: Quote Extraction - Conditions Format

## Capability
Extracción de coberturas de cotizaciones en formato de condiciones contractuales/descriptivas (tipo Allianz), donde las coberturas aparecen en texto narrativo con bullets en lugar de tablas estructuradas.

## User Story
**Como** sistema de análisis
**Quiero** extraer coberturas de documentos de condiciones de seguro
**Para** analizar cotizaciones de aseguradoras como Allianz que usan formato descriptivo

## Requirements

### Requirement: Detect Conditions format family
The system SHALL detect when a PDF uses the "CONDITIONS" format family.

#### Scenario: Allianz conditions document detection
- **WHEN** extracted text contains "COBERTURA BÁSICA" AND "COBERTURAS ESPECIFICAS Y LIMITES" AND section numbers like "8." or "9."
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 90%
- **AND** set hasSections to true

#### Scenario: General conditions format detection
- **WHEN** extracted text contains narrative descriptions of coverages with bullet points AND "condiciones del contrato" OR "condiciones particulares"
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 85%

### Requirement: Extract coverages from narrative text
The system SHALL extract individual coverages from descriptive paragraphs and bullet lists.

#### Scenario: Extract from bullet points
- **WHEN** the document contains "✓ Incendio y/o rayo o sus efectos inmediatos"
- **THEN** the system SHALL extract coverage: "Incendio y/o rayo o sus efectos inmediatos"
- **AND** infer that it belongs to the "Todo Riesgo Daño Material" basic coverage

#### Scenario: Extract from numbered sections
- **WHEN** section 8 lists "Todo riesgo daño material incluyendo:" followed by bullets
- **THEN** the system SHALL extract each bullet as a separate coverage
- **AND** assign them to the parent coverage "Todo Riesgo Daño Material"

#### Scenario: Extract sub-limits from conditions
- **WHEN** a coverage mentions "sublimitado al X%" or "limitado a $Y"
- **THEN** the system SHALL capture the sub-limit value
- **AND** create a subLimits entry

### Requirement: Handle missing insured amounts
The system SHALL handle cases where individual coverages don't have explicit insured amounts.

#### Scenario: Use total insured value from header
- **WHEN** coverages are listed without individual insured amounts
- **THEN** the system SHALL use the total valor asegurado from the document header
- **AND** distribute it among coverages proportionally or mark as "Total aplicable"

#### Scenario: Mark as included in base coverage
- **WHEN** a bullet says "Incluye incendio, explosión, daños por agua"
- **THEN** the system SHALL mark these as included in the base coverage
- **AND** set insuredAmount to null with note "Incluido en Todo Riesgo"

### Requirement: Extract deductibles from conditions
The system SHALL find deductibles mentioned anywhere in the conditions document.

#### Scenario: Deductible in separate section
- **WHEN** a section mentions "El deducible será del X% del valor del siniestro"
- **THEN** the system SHALL capture this as a general deductible
- **AND** apply it to all property damage coverages

#### Scenario: No deductible specified
- **WHEN** no deductible is mentioned in the conditions document
- **THEN** the system SHALL set deductible to "Ver clausulado"
- **AND** log that deductibles need to be extracted from the clause document

### Requirement: Generate structured output
The system SHALL produce the same QuoteExtractionSchemaV2 output regardless of input format.

#### Scenario: Consistent schema output
- **WHEN** extracting from a CONDITIONS format document
- **THEN** the output SHALL conform to QuoteExtractionSchemaV2
- **AND** include insurerName, policyName, premium, rawCoverages, subLimits, generalDeductibles
- **AND** notes field SHALL explain any inferred values

## Dependencies
- `format-family-detection` for format classification
- `multimodal-pdf-extraction` for PDF vision processing
- `quote-analysis-v2` for schema validation
