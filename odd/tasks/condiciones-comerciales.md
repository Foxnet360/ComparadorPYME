# Feature: Extracción, Edición y Reporte de Condiciones Comerciales en Cotizaciones

Implementación integral de extracción, normalización, edición previa a exportación y renderizado en PDF y Excel de las Condiciones Comerciales presentes en las cotizaciones de aseguradoras.

## Specs

- S1: En los documentos donde se haga referencia a "Condiciones Comerciales", extraer las condiciones que se proponen en las cotizaciones (Validez de la oferta, Forma de pago y financiación, Inspección previa y garantías, Requisitos de emisión, Compromisos o cláusulas especiales) mediante los prompts de comparación unificada.
- S2: Normalizar y mapear alias de condiciones comerciales en `comparisonSchema.ts`, `flatTableParser.ts` y `matrixTransformer.ts`.
- S3: Soportar la estructura tipada de `commercialConditions` por aseguradora en `types.ts` y `server/src/types.ts` asociada al reporte y a la matriz.
- S4: Permitir al usuario editar las condiciones comerciales de cada aseguradora antes de construir el Excel o PDF en `ExportModal.tsx` / `ComparisonReport.tsx`.
- S5: Incluir la tabla comparativa de condiciones comerciales de las aseguradoras en el reporte Excel generado (`excelGenerator.ts`).
- S6: Incluir la tabla comparativa de condiciones comerciales de las aseguradoras en el reporte PDF generado (`services/pdfService.ts`).
- S7: Verificar la integración mediante tests unitarios de schema, parser, excel y export modal.

## Tasks

- [x] T1: (S1, S2) Prompt engineering y normalización de 'CONDICIONES COMERCIALES' en `comparisonPromptBuilder.ts`, `comparisonSchema.ts` y `flatTableParser.ts`. Route: inline. Commit: local.
- [x] T2: (S3, S4) Tipos de datos y editor interactivo de condiciones comerciales previo a la exportación en `types.ts` y `ExportModal.tsx`. Route: inline. Commit: local.
- [x] T3: (S5) Renderizado de la tabla comparativa de condiciones comerciales en `excelGenerator.ts`. Route: inline. Commit: local.
- [x] T4: (S6) Renderizado de la tabla comparativa de condiciones comerciales en `services/pdfService.ts`. Route: inline. Commit: local.
- [x] T5: (S7) Pruebas automatizadas y verificación end-to-end de suites. Route: inline. Commit: local.

## Log

- L1: "Para los documentos donde se haga referencia a \"Condiciones Comerciales\", debes extraer las condiciones que se proponen en las cotizaciones. Analiza esta situación y plantea una forma de resolverlo."
- L2: "Si. Ademas incluirlo en el excel y en el PDF tambien. Que el usuario pueda editarlos antes de construir el excel o PDF de informe."
