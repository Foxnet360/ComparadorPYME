# ODD Feature: Comparativo Multi-Producto (6-9 Cotizaciones) y Fix Colapso Misma Aseguradora
Rama: `feat/multi-producto-comparacion`

## Specs
- S1: Corregir colapso de coberturas/deducibles/primas cuando se comparan 2 o más productos de la misma aseguradora (ej. 3 cotizaciones de Seguros SURA en Salud).
- S2: Soportar comparativos ordinarios de 6 a 9 archivos (3+ aseguradoras × 2–3 productos por aseguradora), comparables por aseguradora y tipo de producto.

## Tasks
- [x] T1 (S1): Corregir `parseJsonWithInsurersArray` y `parseJsonV2` en `flatTableParser.ts` para emparejar celdas sin colapsar por nombre canónico repetido (`alignRowCellsToInsurers` + `buildUniqueInsurerLabels`) | route: inline | commit: committed
- [x] T2 (S1, S2): Desambiguar `insurerNames` en `reportBuilderService.ts` y reforzar `comparisonPromptBuilder.ts` para distinguir `Aseguradora - Producto` | route: inline | commit: committed
- [x] T3 (S2): Enrutar lotes `> 3` PDFs a extracción aislada por cotización (`runPerQuoteBatch`) en `comparisonEngineAdapter.ts` y ampliar `maxCount` de `quotes` a 15 en `server/src/index.ts` | route: inline | commit: committed
- [x] T4 (S2): Mostrar `policyName` (producto/plan) en `MatrixTableHeader.tsx` debajo de la aseguradora | route: inline | commit: committed
- [x] T5 (S1, S2): Agregar pruebas unitarias de regresión para 3 productos de SURA (`flatTableParser.test.ts`, 53/53) y verificar `tsc` frontend/backend (`ALL_OK`) | route: inline | commit: committed

## Log
- L1 (User): "he probado la auditoria de 'Salud', como en ese ramo normalmente se comparan diferentes 'Productos' de una misma aseguradora, en el caso de Seguros SURA, se suministraron 3 cotizaciones para el mismo cliente, con productos diferenes, la extracción de la metadata se realizo adecuadamente, pero todo lo demas fallo, porque se presentaban los mismos datos de la primera cotización comparados con ellos mismos..."
- L2 (User): "...normalmente a sus clientes les entregan un cuadro comparativo que esta elaborado por al menos 3 aseguradoras, con sus diferentes productos, que pueden ser 2 o 3 por aseguradora, por tanto una cotización ordinaria de este ramo puede contener de 6 a 9 archivos, que se comparan entre ellos, por aseguradora y tipo de producto. ... Avanzar con eso. Crear el plan detallado del cambio, codificar el cambio y realizar pruebas de validación"
