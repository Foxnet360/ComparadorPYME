# Spec: Tubería Multimodal Holística y Evidencia por Cita

## Requirement: Ingesta Holística Atómica de PDFs
The analysis pipeline MUST ingest quotation PDFs in their entirety using native multimodal vision without splitting pages into lossy text chunks.

### Scenario: Ingesting a multi-page PDF quotation
- **GIVEN** a 6-page PDF quotation with coverages on page 2 and deductibles on page 5
- **WHEN** processing the analysis request
- **THEN** the engine MUST evaluate all 6 pages in a single context window
- **AND** correct cross-page associations between coverages and deductibles.

## Requirement: Metadatos de Evidencia y Cita de Página
Every extracted coverage and deductible MUST include exact page citations and literal text snippets from the PDF.

### Scenario: Inspecting coverage citation
- **WHEN** viewing a coverage item in the comparison matrix
- **THEN** the system MUST display the exact `pageNumber`
- **AND** the literal `sourceSnippet` extracted from the source PDF.
