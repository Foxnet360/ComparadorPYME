# Spec: Extracción Estructurada Multimodal en Dos Fases con Respaldo Automático

## Requirements

### Requirement 1: Extractor de Estructura Global y Metadatos (Fase 1)
`server/src/services/twoStageExtraction/globalStructureExtractor.ts` MUST:
- Accept document text and PDF path.
- Extract insurer name, product/policy name, validity period, insured assets, and complete premium breakdown (`netPremium`, `fees`, `taxes`, `totalPayable`).
- Identify table sections containing coverages (`sectionName`, `pageHint`, `confidence`).
- Return a typed `GlobalStructureExtraction` object.
- Complete execution with low token footprint (< 600 output tokens).

#### Scenario: Extracción de cotización con tabla en páginas 3 a 5
- **GIVEN** a multi-page quote PDF where coverages are located on pages 3, 4, and 5
- **WHEN** evaluated by `globalStructureExtractor.extractGlobalStructure`
- **THEN** it SHALL extract the insurer, full premium breakdown, and detect the coverage section targeting pages 3-5.

---

### Requirement 2: Extractor Focalizado de Coberturas y Deducibles (Fase 2)
`server/src/services/twoStageExtraction/focalizedCoverageExtractor.ts` MUST:
- Accept the document context and coverage section hints from Phase 1.
- Extract individual coverage rows with:
  - `rawName`: exact textual name from the document.
  - `insuredAmount`: numeric value when present.
  - `deductible`: exact textual deductible.
  - `sublimit`: textual or numeric sublimit.
  - `pageNumber`: page where the row appears.
  - `rawTextSnippet`: verbatim citation from the source document.
- Validate the extracted items with Zod schemas.

---

### Requirement 3: Orquestador y Fallback a Pipeline V2
`server/src/services/twoStageExtraction/twoStageExtractionOrchestrator.ts` MUST:
- Coordinate Phase 1 and Phase 2 executions sequentially.
- Combine outputs into the standard `QuoteExtractionV2` format.
- IF Phase 1 or Phase 2 fails, times out, or extracts 0 coverages:
  - Log a clear warning with correlation ID.
  - Fall back gracefully to `fallbackExtractor()` without throwing an uncaught exception to the caller.
