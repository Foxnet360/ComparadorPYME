# Spec: Insurer Template Registry

## Capability
Registro de plantillas específicas por aseguradora que permite detectar PDFs de cotización por huellas de texto y layout, y aplicar esquemas de extracción JSON estructurados por template.

## User Story
**Como** sistema de análisis de cotizaciones
**Quiero** reconocer la plantilla de cada aseguradora antes de extraer coberturas
**Para** usar esquemas estrictos y prompts especializados que mejoren la precisión de extracción

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

### Requirement: Enforce template schemas

The system SHALL constrain extracted fields to a JSON schema defined per template.

#### Scenario: Schema-valid extraction

- **GIVEN** a known template is detected
- **WHEN** the LLM returns extracted cells
- **THEN** the system SHALL validate the payload against the template schema
- **AND** reject fields that violate type, range, or required constraints

## Data Contracts

### Template Registry Entry

```json
{
  "templateId": "bbva-pyme-v1",
  "insurer": "BBVA",
  "displayName": "BBVA PYME",
  "fingerprints": {
    "textMarkers": ["BBVA SEGUROS", "COBERTURAS / DEDUCIBLE"],
    "layoutMarkers": [{ "page": 1, "region": "top-right", "textRegex": "BBVA" }]
  },
  "schema": {
    "type": "object",
    "required": ["coverages"],
    "properties": {
      "coverages": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["rawName", "insuredAmount", "deductible"],
          "properties": {
            "rawName": { "type": "string" },
            "insuredAmount": { "type": "string" },
            "deductible": { "type": "string" },
            "premium": { "type": "string" },
            "subLimits": { "type": "array" }
          }
        }
      }
    }
  }
}
```

## Error Handling

| Failure | Expected Behavior |
|---------|-------------------|
| Template fingerprint match below threshold | Treat as unknown template; fall back to generic family + vision extraction. |
| Template schema validation failure | Return structured error with violated fields; fall back to vision path. |

## Dependencies

- `pdfjs-dist` for layout extraction.
- Supabase/Redis storage for template registry.
- Analyst validation time for template schemas.
