# ODD Feature: Particularización Funcional para Cumplimiento y Fianzas (Licitación vs. Contrato vs. Otrosí)

Rama: `feat/particularizacion-cumplimiento-fianzas` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run typecheck:backend && npm run typecheck:frontend && npm run test:unit`

## Specs

- S1 (Taxonomía Ampliada y Extracción de `cumplimientoDetails`, `% del Contrato` y `Vigencia por Amparo`): Ampliar `data/domains/cumplimiento/taxonomy.json` de 15 a 18 categorías (`cum_16` Subamparos de RCE Derivada, `cum_17` Contragarantías Exigidas y Cupo de Afianzamiento, `cum_18` Régimen Jurídico y Cláusula de Irrevocabilidad); agregar `percentageOfContract` y `coverageValidity` en `RawCoverageSchema`, `FocalizedCoverageExtractor`, `coverageNormalizer` y `ParsedCoverage`; agregar `CumplimientoDetailsSchema` en `extractionSchemas.ts`, `twoStageExtraction.ts`, `globalStructureExtractor.ts`, `twoStageExtractionOrchestrator.ts`, `cumplimientoPromptStrategy.ts`, `quoteParser.ts` y `multimodalPipeline.ts`.
- S2 (Matriz Comparativa de Cumplimiento, Auditoría Normativa por Etapa y Scoring): En `matrixTransformer.ts`, enriquecer celdas de amparos con `% del Contrato` y `Vigencia` y renderizar la sección `FICHA TÉCNICA DE LICITACIÓN / CONTRATO Y SUSCRIPCIÓN` (`CUMPLIMIENTO_SECTION_ID = 76`); en `regulatoryAuditService.ts`, hacer la auditoría de `cumplimiento` sensible a la etapa (`PRECONTRACTUAL_LICITACION` vs. `CONTRACTUAL_EJECUCION`) para eliminar falsos `NON_COMPLIANT` entre Seriedad de la Oferta y Garantía Única de Ejecución; en `quoteScorer.ts`, ajustar el cálculo de cobertura esperada según la etapa precontractual/contractual y bonificar porcentajes, vigencias y contragarantías explícitas.
- S3 (Selector de Etapa Contractual y Documento Rector en `AnalyzerPage.tsx` y `ClauseSelector.tsx`): Cuando `domain === 'cumplimiento'`, mostrar el selector de etapa (`Automático (IA)`, `Licitación / Pliego (Seriedad)`, `Contrato / Minuta (Ejecución + RCE)`, `Otrosí (Adición / Prórroga)`) y contextualizar el panel derecho de documentos de referencia para cargar Pliego de Condiciones, Minuta del Contrato, Otrosí o Clausulados.

## Tasks

- [x] T1 | S1 | route: inline | status: completed | commit: 92a2ddd — Taxonomía `cumplimiento` (18 categorías) + extracción de `cumplimientoDetails`, `percentageOfContract` y `coverageValidity` (Risk: item 3 contratos compartidos)
- [x] T2 | S2 | route: inline | status: completed | commit: 1da7929 — Sección `FICHA TÉCNICA DE LICITACIÓN / CONTRATO Y SUSCRIPCIÓN` en `matrixTransformer.ts`, auditoría por etapa en `regulatoryAuditService.ts` y scoring en `quoteScorer.ts` (Risk: item 3 contratos compartidos)
- [x] T3 | S3 | route: inline | status: completed | commit: 0f55fe0 — Selector de Etapa Contractual y Documento Rector en `AnalyzerPage.tsx` y `ClauseSelector.tsx` + tests

## Log

- L1 (2026-11-23): Usuario aprobó `plan_particularizacion_cumplimiento_fianzas.md` para implementar los 4 componentes de particularización del ramo Cumplimiento y Fianzas.
- L2 (2026-11-23): T1 (`92a2ddd`), T2 (`1da7929`) y T3 (`0f55fe0`) completados; `typecheck:backend`, `typecheck:frontend`, `format:check` y tests en verde.
