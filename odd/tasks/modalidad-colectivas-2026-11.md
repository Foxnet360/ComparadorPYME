# ODD Feature: Modalidad Colectivas para Vehículos (Autos), Salud y Vida Grupo

Rama: `feat/modalidad-colectivas-autos-salud-vida` | Estrategia de entrega: `single-pr` | Runner: `npm run format:check && npm run typecheck:backend && npm run typecheck:frontend && npm run test:unit`

## Specs

- S1 (Taxonomías de Colectivas en `autos`, `salud` y `vida_grupo`): Ampliar `data/domains/autos/taxonomy.json` con `auto_15` (Amparo Patrimonial / Culpa Grave), `auto_16` (Responsabilidad Civil en Exceso / Segundo Límite de Flota) y `auto_17` (Condiciones de Flota y Descuento por Siniestralidad); `data/domains/salud/taxonomy.json` con `salud_18` (Continuidad de Antigüedad y Exoneración de Carencias) y `salud_19` (Estructura Tarifaria por Censo / Rangos Etarios y Parentesco); y `data/domains/vida_grupo/taxonomy.json` con `vg_17` (Free Cover / Límite de Asegurabilidad Automática sin Exámenes Médicos), `vg_18` (Tasa por Mil (‰) y Cúmulo Total Asegurado) y `vg_19` (Participación de Utilidades por Buena Siniestralidad).
- S2 (Extracción Multimodal `collectiveDetails`, Ficha Técnica en Matriz e IVA 5% en Salud): Agregar `CollectiveDetailsSchema` en `extractionSchemas.ts`, `twoStageExtraction.ts`, `globalStructureExtractor.ts`, `twoStageExtractionOrchestrator.ts`, `autosPromptStrategy.ts`, `saludPromptStrategy.ts`, `vidaGrupoPromptStrategy.ts`, `multimodalPipeline.ts` y `ParsedQuote`; renderizar la sección `FICHA TÉCNICA DE COLECTIVO / FLOTA` en `matrixTransformer.ts` (modalidad, N° de vidas/vehículos, cúmulo asegurado, tasa por mil, Free Cover, edades de ingreso/permanencia, continuidad/preexistencias, participación de utilidades y desglose por categorías/franjas) y ajustar el IVA de respaldo en `salud` al 5% (`IVA (5% Tarifa Especial PVS Art. 468-3 E.T.)`).
- S3 (Scoring de Colectivas y Promoción de Flotas a Portafolio): Bonificar en `quoteScorer.ts` coberturas críticas de colectivas (`Free Cover`, `Amparo Patrimonial`, `Continuidad de Antigüedad`); habilitar en `policyPromotion.ts` y `PromoteQuoteModal.tsx` la modalidad Flota/Colectiva para `autos` (`is_fleet: true`, `vehicle_count`, `value` con `plate: 'FLOTA'` / `model: 'MÚLTIPLE'`) manteniendo compatibilidad total con vehículos individuales.

## Tasks

- [x] T1 | S1 | route: inline | status: completed | commit: e06da2f — Actualizar `taxonomy.json` en `autos` (17 categorías), `salud` (19 categorías) y `vida_grupo` (19 categorías) + tests de registro
- [x] T2 | S2 | route: inline | status: completed | commit: 788c89e — Implementar `collectiveDetails` en schemas, two-stage extractor, prompt strategies, `multimodalPipeline` y `matrixTransformer` (con IVA 5% en `salud`) + tests (Risk: item 3 contratos compartidos)
- [x] T3 | S3 | route: inline | status: completed — Bonificaciones de scoring colectivo en `quoteScorer.ts` y soporte de Flotas en `policyPromotion.ts` y `PromoteQuoteModal.tsx` + tests (Risk: item 3 contratos compartidos)

## Log

- L1 (2026-11-23): Usuario solicitó `/plan Analizar para los ramos de Vehiculos, Salud y Vida, como sería la modalidad de "Colectivas"...` y aprobó `plan_colectivas_vehiculos_salud_vida.md` (Opción A recomendada).
- L2 (2026-11-23): T1 (`e06da2f`), T2 (`788c89e`) y T3 completados; `typecheck:backend`, `typecheck:frontend`, `format:check` y `test:unit` (249/249 archivos, 2021 passed | 8 skipped) en verde.
