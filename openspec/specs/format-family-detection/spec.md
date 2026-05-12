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
