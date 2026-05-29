# Spec: Reverse String Anchoring

## Capability
Mapeo determinista de páginas físicas en documentos PDF mediante fragmentos textuales extraídos por LLM.

## User Story
**Como** suscriptor de seguros
**Quiero** verificar exactamente en qué página del PDF se encuentra cada cobertura
**Para** auditar la extracción y evitar alucinaciones de página

## Requirements

### Requirement: Deterministic Reverse String Page Mappings
The system SHALL match a textual evidence snippet (`rawTextSnippet`) extracted by the LLM against the page-by-page text structure of pdf.js to determine the exact origin page.

#### Scenario: Substring match locates exact page
- **WHEN** the system has a page-by-page text map from pdfjs
- **AND** the LLM extracts an exact coverage snippet
- **THEN** the system SHALL perform a substring search across all pages
- **AND** assign the matching page index to the coverage cell in the comparison matrix

#### Scenario: Tolerant substring search cleans characters
- **WHEN** the snippet or page texts contain formatting noise (guiones, saltos de línea redundantes, espacios dobles)
- **THEN** the system SHALL execute `cleanTextForMatching` removing all non-alphanumeric characters and redundant spacing from both texts
- **AND** perform the comparison over the cleaned strings
- **AND** successfully resolve the correct page
