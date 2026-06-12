# Spec: Layout-Aware Quote Extraction

## Capability
Reconstrucción de filas y columnas de tablas de cotización a partir de coordenadas de `pdfjs` antes de enviar los datos al LLM, con fallback al camino de visión cuando el layout no pueda reconstruirse.

## User Story
**Como** sistema de extracción de cotizaciones
**Quiero** reconstruir la estructura tabular del PDF antes de pedirle al LLM que complete celdas
**Para** reducir alucinaciones y aprovechar los layouts regulares de cada aseguradora

## ADDED Requirements

### Requirement: Reconstruct tables from PDF layout

The system SHALL rebuild row/column structure from `pdfjs` bounding boxes before LLM extraction.

#### Scenario: Table reconstruction succeeds

- **GIVEN** a PDF page contains a coverage table with aligned columns
- **WHEN** layout parsing runs
- **THEN** the system SHALL return rows with cell coordinates, text, and inferred column headers
- **AND** preserve row order and merged-cell annotations

#### Scenario: Layout parse failure falls back to vision

- **GIVEN** `pdfjs` cannot reconstruct a table (e.g., rotated or scanned page)
- **WHEN** layout parsing fails
- **THEN** the system SHALL log the failure
- **AND** fall back to the vision-based extraction path

## Data Contracts

### Layout Reconstruction Output

```json
{
  "page": 1,
  "tables": [{
    "rows": [[{"text": "Incendio", "x": 120, "y": 300, "width": 80, "height": 12}]],
    "headers": ["Cobertura", "Suma Asegurada", "Deducible", "Prima"]
  }]
}
```

## Error Handling

| Failure | Expected Behavior |
|---------|-------------------|
| `pdfjs` layout parse failure | Log `layout_parse_failed` metric; fall back to legacy vision path. |

## Dependencies

- `pdfjs-dist` for layout extraction.
