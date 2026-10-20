# Design: Extracción Estructurada Multimodal en Dos Fases con Respaldo Automático

## Architecture Overview

```
                      [quoteProcessingService.ts]
                                 │
             ┌───────────────────┴───────────────────┐
             │ enableTwoStageExtraction === true     │ false (Legacy Fallback)
             ▼                                       ▼
  [twoStageExtractionOrchestrator.ts]       [geminiService.extractFromPdfWithVision]
             │
             ├───────────── Fase 1 ─────────────┐
             ▼                                  │
  [globalStructureExtractor.ts]                 │
  (Metadatos, Primas, Secciones)               │
             │                                  │
             ├───────────── Fase 2 ─────────────┤
             ▼                                  │
  [focalizedCoverageExtractor.ts]               │
  (Amparos, Deducibles, Citas, Páginas)         │
             │                                  │
             ├─ [Éxito] ──> QuoteExtractionV2   │
             │                                  │
             └─ [Fallo/Cero Coberturas] ────────┘
                  Fallback automático a V2
```

## Decisions & Rationale

### 1. Respeto Estricto al Contrato `QuoteExtractionV2`
* **Decisión:** La salida del orquestador de dos fases produce un objeto que cumple exactamente con el esquema Zod `QuoteExtractionV2`.
* **Razón:** Toda la maquinaria de downstream (`coverageNormalizer`, `matrixTransformer`, `reconciliationService`, `quoteScorer`) permanece completamente intacta sin requerir adaptación.

### 2. Fallback de Cero Riesgo
* **Decisión:** Envolver la llamada al orquestador en un bloque `try/catch` robusto. Si la llamada de dos fases no extrae al menos una cobertura o falla por parsing, se recurre automáticamente al método original de una sola pasada.
* **Razón:** Garantizar que ninguna cotización del corredor falle por un error en la nueva funcionalidad.
