# Tasks: Saneamiento de Integridad, Eliminación de Código Muerto y Unificación Arquitectónica

## Phase 1: Unificación de Constantes y Saneamiento de SMMLV/UVT
- [x] 1.1 Centralizar SMMLV (2025: $1.423.500) y UVT (2025: $49.799) en `server/src/config/env.ts` y `server/src/config/domainConstants.ts`.
- [x] 1.2 Limpiar valores hardcodeados obsoletos (`1300000`) en archivos de datos (`thesaurus.json`) y suites de test.
- [x] 1.3 Verificar consistencia con tests de deducibles monetarios.

## Phase 2: Centralización del Modelo Gemini
- [x] 2.1 Unificar en `server/src/services/gemini.ts` la resolución del modelo para que todas las funciones utilicen `env.GEMINI_MODEL || 'gemini-3.7-flash'`.
- [x] 2.2 Reemplazar el hardcode `'gemini-3.5-flash'` en `server/src/services/unifiedComparison/deepClauseValidator.ts:227`.
- [x] 2.3 Actualizar scripts de diagnóstico para retirar referencias a modelos inexistentes como `gemini-pro`.

## Phase 3: Eliminación de Componentes y Código Huérfano Frontend
- [x] 3.1 Eliminar `components/AuditWizard.tsx` (224 LOC huérfanas).
- [x] 3.2 Eliminar `components/VariableComparisonMatrix.tsx` (288 LOC huérfanas).
- [x] 3.3 Eliminar `components/DeductibleSummaryTable.tsx` (337 LOC huérfanas).
- [x] 3.4 Verificar que las exportaciones y páginas compilen limpiamente sin estas referencias.

## Phase 4: Saneamiento del Transformador de Matriz en Frontend
- [x] 4.1 Eliminar la función local duplicada `transformQuotesToMatrix` (210 LOC) de `components/UnifiedCoverageMatrix.tsx`.
- [x] 4.2 Ajustar el componente para consumir exclusivamente las filas provistas por el backend (`rows`), garantizando estados limpios de carga y vacío sin corromper la taxonomía de Hogar con categorías de PYME.

## Phase 5: Depuración de Código Muerto Backend y Feature Flags
- [x] 5.1 Eliminar el servicio muerto `server/src/services/deductibleParser.ts` y sus tests asociados (`deductibleParser.test.ts`, `deductibleParser.unit.test.ts`).
- [x] 5.2 Limpiar las feature flags fantasma en `server/src/config/featureFlags.ts`: `deductibleSemanticParser`, `tripleSourceChat`, `queryExpansion`, `hybridSearchV2`.
- [x] 5.3 Ejecutar suites completas de backend, frontend y verificación de tipos (TypeScript).
