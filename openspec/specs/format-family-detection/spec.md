# Spec: Format Family Detection

## Capability
Detección automática de la familia de formato de un PDF de cotización basada en patrones de texto extraído, para seleccionar el prompt especializado correcto.

## User Story
**Como** sistema de análisis
**Quiero** detectar automáticamente el formato de la cotización
**Para** seleccionar el prompt de extracción adecuado para cada estructura de documento

## ADDED Requirements

### Requirement: Detect format family from PDF text
The system SHALL analyze extracted text and classify it into one of six format families.

#### Scenario: TABLE-DOUBLE detection (HDI style)
- **WHEN** extracted text contains "DEDUCIBLES QUE APLICAN" AND "AMPAROS BASICOS"
- **THEN** the system SHALL classify as "TABLE-DOUBLE"
- **AND** set confidence to 95%

#### Scenario: TABLE-INTEGRATED detection (CHUBB style)
- **WHEN** extracted text contains "Suma Asegurada" AND "Deducible" AND text matches /sub[líi]mite/i
- **THEN** the system SHALL classify as "TABLE-INTEGRATED"
- **AND** set confidence to 95%

#### Scenario: SECTIONS detection (MAPFRE style)
- **WHEN** extracted text matches /SECCION\s+(PRIMERA|SEGUNDA|TERCERA)/i
- **THEN** the system SHALL classify as "SECTIONS"
- **AND** set confidence to 95%

#### Scenario: DESCRIPTIVE detection (AXA style)
- **WHEN** extracted text contains "Este amparo cubre" OR "Se cubren los daños" OR text matches /cubre\s+las\s+pérdidas/i
- **THEN** the system SHALL classify as "DESCRIPTIVE"
- **AND** set confidence to 90%

#### Scenario: PRICE-TABLE detection (SBS style)
- **WHEN** extracted text matches /Resumen\s+de\s+coberturas\s+y\s+primas/i AND text matches /\$\s*[\d.,]+\s*(?:PRIMA|IMPUESTOS)/i
- **THEN** the system SHALL classify as "PRICE-TABLE"
- **AND** set confidence to 95%

#### Scenario: TEXT detection (BOLIVAR style)
- **WHEN** none of the above patterns match
- **THEN** the system SHALL classify as "TEXT"
- **AND** set confidence to 70%

#### Scenario: Unknown format fallback
- **WHEN** text is empty or too short (< 500 chars)
- **THEN** the system SHALL classify as "TEXT" with confidence 50%
- **AND** log a warning: "Insufficient text for format detection, using TEXT fallback"

### Requirement: Provide format metadata
The system SHALL return format family information alongside detection results.

#### Scenario: Return format metadata
- **WHEN** format detection completes
- **THEN** the system SHALL return:
  - family: string (one of the 6 families)
  - confidence: number (0-100)
  - detectedPatterns: string[] (which patterns matched)
  - pageCount: number (total pages in PDF)
  - hasTables: boolean (detected table-like structures)
  - hasSections: boolean (detected numbered sections)

### Requirement: Format detection performance
The system SHALL detect format family quickly without full AI processing.

#### Scenario: Fast detection
- **WHEN** a PDF is uploaded
- **THEN** format detection SHALL complete in < 100ms
- **AND** it SHALL use only regex patterns on the first 2000 characters
- **AND** no AI call SHALL be made during detection

## Dependencies
- `pdf-text-extraction-v2` for initial text extraction (first 2000 chars)
- `multimodal-pdf-extraction` for the actual extraction using detected format

---

## ADDED Requirements (from change: correccion-cotizacion-allianz)

### Requirement: Detect CONDITIONS format family
The system SHALL detect the "CONDITIONS" format family for Allianz-style documents.

#### Scenario: Allianz conditions document
- **WHEN** extracted text contains "COBERTURA BÁSICA" AND "COBERTURAS ESPECIFICAS Y LIMITES" AND section numbers like "8." or "9."
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 90%
- **AND** set hasSections to true

#### Scenario: General conditions format
- **WHEN** extracted text contains narrative descriptions of coverages with bullet points AND "condiciones del contrato" OR "condiciones particulares"
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 85%

### MODIFIED Requirements

#### Requirement: Updated FormatFamily type
The FormatFamily type SHALL include the new "CONDITIONS" value.

##### Scenario: Complete family list
- **WHEN** the system lists supported format families
- **THEN** it SHALL include: TABLE-DOUBLE, TABLE-INTEGRATED, SECTIONS, DESCRIPTIVE, PRICE-TABLE, TEXT, CONDITIONS, UNKNOWN

#### Requirement: Format detection patterns updated
The format detection patterns SHALL include CONDITIONS patterns.

##### Scenario: Pattern priority
- **WHEN** multiple patterns match
- **THEN** CONDITIONS SHALL have weight 0.95 (same as DESCRIPTIVE)
- **AND** TABLE-DOUBLE and TABLE-INTEGRATED still have priority 1.0

---

## Delta from change: correccion-cotizacion-allianz

# Spec: Format Family Detection (Delta)

## Delta for: format-family-detection

## Changes

### ADDED Requirements

#### Requirement: Detect CONDITIONS format family
The system SHALL detect the "CONDITIONS" format family for Allianz-style documents.

##### Scenario: Allianz conditions document
- **WHEN** extracted text contains "COBERTURA BÁSICA" AND "COBERTURAS ESPECIFICAS Y LIMITES" AND section numbers like "8." or "9."
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 90%
- **AND** set hasSections to true

##### Scenario: General conditions format
- **WHEN** extracted text contains narrative descriptions of coverages with bullet points AND "condiciones del contrato" OR "condiciones particulares"
- **THEN** the system SHALL classify as "CONDITIONS"
- **AND** set confidence to 85%

### MODIFIED Requirements

#### Requirement: Updated FormatFamily type
The FormatFamily type SHALL include the new "CONDITIONS" value.

##### Scenario: Complete family list
- **WHEN** the system lists supported format families
- **THEN** it SHALL include: TABLE-DOUBLE, TABLE-INTEGRATED, SECTIONS, DESCRIPTIVE, PRICE-TABLE, TEXT, CONDITIONS, UNKNOWN

#### Requirement: Format detection patterns updated
The format detection patterns SHALL include CONDITIONS patterns.

##### Scenario: Pattern priority
- **WHEN** multiple patterns match
- **THEN** CONDITIONS SHALL have weight 0.95 (same as DESCRIPTIVE)
- **AND** TABLE-DOUBLE and TABLE-INTEGRATED still have priority 1.0

### Impact
- `formatDetector.ts`: Add CONDITIONS to FormatFamily union type and patterns
- `promptBuilder.ts`: Add CONDITIONS prompt template
- All format consumers: Update switch statements to handle CONDITIONS

---

## Delta from change: mejora-extraccion-coberturas

## ADDED Requirements

### Requirement: Detect insurer-specific templates

The system SHALL identify known insurer templates from PDF layout and text markers before extraction.

#### Scenario: BBVA template detected

- **GIVEN** a PDF contains "BBVA SEGUROS" and a table headed "COBERTURAS / DEDUCIBLE"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"bbva-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the BBVA schema

#### Scenario: SBS template detected

- **GIVEN** a PDF contains "SEGUROS SBS" and "Resumen de coberturas y primas"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"sbs-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the SBS schema

#### Scenario: MAPFRE template detected

- **GIVEN** a PDF contains "MAPFRE" and section markers "SECCION PRIMERA/SEGUNDA"
- **WHEN** format detection runs
- **THEN** the system SHALL return templateId `"mapfre-pyme-v1"` with confidence >= 90%
- **AND** route extraction through the MAPFRE schema

#### Scenario: Unknown insurer falls back to graph

- **GIVEN** a PDF matches no registered template
- **WHEN** extraction runs
- **THEN** the system SHALL use the legacy vision path
- **AND** send extracted coverages through the semantic graph

## MODIFIED Requirements

### Requirement: Detect format family from PDF text

The system SHALL analyze extracted text and classify it into one of six format families, and SHALL additionally detect insurer-specific templates.

(Previously: format detection selected only among six generic families.)

#### Scenario: TABLE-DOUBLE detection (HDI style)

- **WHEN** extracted text contains "DEDUCIBLES QUE APLICAN" AND "AMPAROS BASICOS"
- **THEN** the system SHALL classify as "TABLE-DOUBLE"
- **AND** set confidence to 95%

#### Scenario: Insurer template takes precedence over generic family

- **WHEN** a PDF matches both a generic family and a registered insurer template
- **THEN** the system SHALL return the insurer templateId
- **AND** set `formatFamily` to the corresponding generic family for compatibility

### Requirement: Provide format metadata

The system SHALL return format family information alongside detection results, including template metadata when applicable.

(Previously: metadata did not include insurer template fields.)

#### Scenario: Return format metadata

- **WHEN** format detection completes
- **THEN** the system SHALL return:
  - `family`: string (one of the 6 families)
  - `confidence`: number (0-100)
  - `detectedPatterns`: string[]
  - `templateId`: string | null
  - `templateConfidence`: number | null
  - `pageCount`: number
  - `hasTables`: boolean
  - `hasSections`: boolean
