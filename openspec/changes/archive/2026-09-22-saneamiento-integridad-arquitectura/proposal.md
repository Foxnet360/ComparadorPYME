# Proposal: Saneamiento de Integridad, Eliminación de Código Muerto y Unificación Arquitectónica

## Intent
Fortalecer la estabilidad, mantenibilidad y resiliencia del proyecto erradicando la deuda técnica acumulada: consolidar las constantes legales (SMMLV/UVT) en un único punto de verdad, unificar la resolución de modelos Gemini, retirar más de 1.500 líneas de código muerto y componentes huérfanos, sanear las feature flags fantasma y eliminar la duplicación de transformadores en el frontend.

## Scope
1. **Unificación de Constantes y Eliminación de Magic Numbers:**
   - Establecer `server/src/config/env.ts` y `server/src/config/domainConstants.ts` como la única fuente de verdad para SMMLV (2025: $1.423.500) y UVT (2025: $49.799 / 2024: $47.065).
   - Reemplazar ocurrencias dispersas de `1300000` en parsers, validadores y data files de taxonomía.
   - Sincronizar tests unitarios para que no dependan de números hardcodeados ni fallen por discrepancia de vigencias salariales.

2. **Centralización y Resiliencia de Modelos Gemini:**
   - Centralizar la referencia al modelo de lenguaje en `env.GEMINI_MODEL` (default: `gemini-3.7-flash` o `gemini-2.5-flash`), eliminando defaults quemados divergentes en `server/src/services/gemini.ts` y `deepClauseValidator.ts`.
   - Normalizar la nomenclatura para evitar strings deprecados o con prefijo inválido (`models/gemini-2.5-flash`).

3. **Eliminación de Código Muerto y Componentes Huérfanos:**
   - **Frontend:** Retirar `components/AuditWizard.tsx` (224 LOC), `components/VariableComparisonMatrix.tsx` (288 LOC), `components/DeductibleSummaryTable.tsx` (337 LOC).
   - **Backend:** Retirar `server/src/services/deductibleParser.ts` (220 LOC) y sus suites de test redundantes, ya que su funcionalidad fue totalmente absorbida por `flatTableParser.ts` y el motor unificado.
   - **Scripts:** Limpiar scripts de prueba obsoletos en `server/src/scripts/` (`listGeminiModels.js`, `verify_gemini.ts` con referencias a `gemini-pro`).

4. **Saneamiento de la Matriz de Coberturas en Frontend:**
   - Eliminar la función clonada `transformQuotesToMatrix` (210 LOC) de `components/UnifiedCoverageMatrix.tsx`, garantizando que la UI use exclusivamente las filas calculadas y validadas por el backend (`rows`), evitando la contaminación de taxonomías PYME en cotizaciones residenciales.

5. **Limpieza de Feature Flags Fantasma:**
   - Retirar de `featureFlags.ts` las flags que no tienen ninguna lógica de control asociada (`deductibleSemanticParser`, `tripleSourceChat`, `queryExpansion`, `hybridSearchV2`).
   - Manejar con gracia o documentar formalmente los placeholders de `deepMode` en `comparisonEngineAdapter.ts`.

6. **Armonización de Contratos Tipados:**
   - Sincronizar las propiedades de `CoverageItem` y `QuoteAnalysis` entre `types.ts` raíz y `server/src/types.ts`.

## Impact
- Eliminación de ~1.500 líneas de código superfluo y reducción del bundle frontend.
- Cero discrepancias en cálculos monetarios de deducibles expresados en SMMLV.
- Eliminación del riesgo de llamadas a modelos de IA inexistentes o no autorizados.
- Mayor velocidad de ejecución de tests y erradicación de falsos positivos en suites unitarias.
