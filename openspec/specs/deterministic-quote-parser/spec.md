# Spec: Deterministic Quote Parser

## Capability
Parser determinístico que convierte salida de texto libre de Gemini en datos estructurados usando regex y normalización con tesauro. **DEPRECATED** - Reemplazado por extracción multimodal con post-normalización.

## User Story
**Como** sistema de análisis (legado)
**Quiero** extraer datos estructurados de respuestas de texto de Gemini
**Para** casos de fallback donde la extracción multimodal no está disponible

## REMOVED Requirements

### Requirement: Regex-based text parsing
**Reason**: Replaced by multimodal PDF extraction with structured JSON schema. Regex parsing cannot handle tabular structures and produces inconsistent results.
**Migration**: Use `multimodal-pdf-extraction` for all new extractions. This parser remains as emergency fallback only.

#### Scenario: Extracting insurer name (DEPRECATED)
- **WHEN** Gemini output contains "ASEGURADORA: HDI SEGUROS COLOMBIA S.A."
- **THEN** the parser extracts "HDI SEGUROS COLOMBIA S.A."
- **AND** stores it in the insurerName field
- **STATUS**: Use `multimodal-pdf-extraction` instead

#### Scenario: Extracting coverages (DEPRECATED)
- **WHEN** Gemini output contains a list of coverages with values and deductibles
- **THEN** the parser extracts each coverage as a structured object
- **AND** handles variations in formatting (bullets, numbers, indentation)
- **STATUS**: Use `multimodal-pdf-extraction` instead

### Requirement: Thesaurus normalization (MOVED)
**Reason**: Normalización de nombres de coberturas ahora es responsabilidad de `coverage-post-normalization`
**Migration**: Use `coverage-post-normalization.mapRawToCanonical()` en lugar de `quoteParser.normalizeCoverageName()`

### Requirement: Parser confidence scoring (DEPRECATED)
**Reason**: La confianza ahora se calcula en post-normalización basada en método de matching (thesaurus, fuzzy, embedding, llm)
**Migration**: Use confidence scores from `coverage-post-normalization` results

## ADDED Requirements

### Requirement: Emergency fallback parsing
The system SHALL retain deterministic parsing as emergency fallback when multimodal extraction is unavailable.

#### Scenario: Multimodal service unavailable
- **WHEN** Gemini File API returns error or is unreachable
- **THEN** the system SHALL fallback to text extraction + deterministic parsing
- **AND** the analysis SHALL be marked with "needsReview: true"
- **AND** a warning SHALL be logged: "Fallback to text extraction due to: {error}"

#### Scenario: PDF text extraction
- **WHEN** fallback is activated
- **THEN** the system SHALL use pdfjs-dist to extract text
- **AND** send text to Gemini with free-text prompt
- **AND** parse response with deterministic parser

## Dependencies
- `text-based-quote-extraction` (legacy) for fallback
- `multimodal-pdf-extraction` (preferred)
