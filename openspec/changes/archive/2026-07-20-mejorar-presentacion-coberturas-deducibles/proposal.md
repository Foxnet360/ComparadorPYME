# Proposal: Mejorar Presentación de Coberturas y Deducibles

## Intent
Dividir coberturas concatenadas y presentar coberturas y deducibles en cuadrículas comparables lado a lado. Habilitar la extracción granular V2 por defecto, unificar taxonomías y corregir la normalización de `SMMLV` y las tarjetas de resumen rotas.

## Scope

### In Scope
- Habilitar extracción V2 granular por defecto vía feature flag.
- Expandir la taxonomía a las 14 coberturas estándar en el prompt de extracción V2 y mapeador.
- Diseñar cuadrícula limpia para visualización de coberturas y deducibles alineados.
- Normalizar variaciones de `S.M.M.L.V` a `SMMLV` antes de parsear.
- Corregir el conteo case-insensitive de deducibles no especificados en `DeductibleMatrix`.

### Out of Scope / Non-Goals
- Modificar el motor de cotización o de suscripción.
- Implementar nuevas integraciones con aseguradoras.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `unified-coverage-matrix`: Renderizar filas granulares en grilla lado a lado usando extracción V2 alineada con 14 categorías.
- `deductible-matrix`: Mostrar deducibles en grilla y reparar tarjetas de métricas usando validaciones case-insensitive.
- `deductible-semantic-parser`: Normalizar variaciones con puntos (`S.M.M.L.V.`) de SMMLV.

## Approach
1. **Backend**: Cambiar `granularComparisonSchema` a `true` en `featureFlags.ts`. Incluir la taxonomía de 14 coberturas estándar en `comparisonPromptBuilder.ts`. Normalizar `S.M.M.L.V.` en `hybridDeductibleParser.ts`.
2. **Frontend**: Actualizar `UnifiedCoverageMatrix` y `ComparisonReport` para una grilla limpia. Corregir check de `"no especificado"` case-insensitive en `DeductibleMatrix.tsx`.

## PR Slicing Recommendation (Max 400 lines/PR)
1. **PR #1 (Backend Extractors & Parsers)**: Activar flag V2, expandir prompt a 14 coberturas, normalizar `SMMLV`. (~200 líneas).
2. **PR #2 (Frontend Grid & Metrics UI)**: Grid de coberturas y deducibles, fix de tarjeta rota en `DeductibleMatrix`. (~180 líneas).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Variabilidad del LLM con 14 categorías | Low | Usar validación estricta Zod en `comparisonPromptBuilder`. |
| Incompatibilidad con reportes antiguos | Low | Fallback gracioso a V1 si falta `schemaVersion === 2`. |

## Rollback Plan
Apagar el flag `granularComparisonSchema` (cambiar a `false`) para revertir a extracción V1 flat inmediatamente.

## Dependencies
- Ninguna externa.

## Success Criteria
- [ ] Visualización de coberturas lado a lado en grilla alineada.
- [ ] Deducibles presentados en grilla limpia con tarjetas de resumen correctas.
- [ ] Normalización exitosa de `S.M.M.L.V` a `SMMLV`.
