## Why

El motor de comparación unificado y el análisis complementario de RAG fallan bajo condiciones reales: el motor unificado de comparación experimenta timeouts debido al límite estricto de 45 segundos al generar complejas estructuras JSON con Gemini 3.5 en su nivel de razonamiento medio, mientras que el módulo de Auditoría de Riesgos RAG reporta falsamente la falta de clausulados indexados debido a que realiza consultas con los nombres largos y no normalizados de las aseguradoras extraídos de las cotizaciones (ej. "SBS SEGUROS COLOMBIA S.A.") en lugar de sus identificadores canónicos (ej. "SBS").

## What Changes

* **Timeouts de Ejecución Incrementados**:
  * Incremento del tiempo límite (`TIMEOUT_MS`) de 45 a **90 segundos** en el motor unificado de comparación (`unifiedComparisonEngine.ts`).
  * Incremento del timeout de llamadas asíncronas en `analysisController.ts` de 5 a **15 segundos** para asegurar la correcta ejecución del pipeline de deducibles y RAG.
* **Normalización de Nombres de Aseguradoras**:
  * Integración sistemática del servicio `insurerNameNormalizer` en las búsquedas en base de datos realizadas por los validadores de cobertura, checker de cobertura inversa, comparador de versiones de clausulados y en las consultas directas al vector store/base de datos.

## Capabilities

### New Capabilities
* Ninguna.

### Modified Capabilities
* `clause-coverage-validation`: La validación de existencia de clausulados y extracción de coberturas asociadas debe realizarse utilizando de forma canónica el nombre de aseguradora normalizado.
* `inverse-coverage-check`: La verificación de coberturas obligatorias faltantes debe normalizar el nombre de aseguradora antes de consultar y contrastar las coberturas contra la base de datos de clausulados.
* `clause-version-comparison`: La obtención del historial de versiones de un clausulado debe ejecutarse normalizando previamente el parámetro del nombre de aseguradora.

## Impact

* **Archivos Afectados**:
  * `server/src/services/unifiedComparison/unifiedComparisonEngine.ts`
  * `server/src/controllers/analysisController.ts`
  * `server/src/services/clauseCoverageValidator.ts`
  * `server/src/services/inverseCoverageChecker.ts`
  * `server/src/services/clauseVersionComparator.ts`
  * `server/src/services/vectorStore.ts`
* **Base de Datos / Supabase**: Búsquedas a tablas `documents`, `clause_coverages` y búsquedas semánticas.
