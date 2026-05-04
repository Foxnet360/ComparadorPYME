## Why

Las secciones "Coberturas No Categorizadas" y "Texto Completo de Deducibles" presentan problemas críticos de usabilidad que dificultan la comparación técnica de cotizaciones de seguros:

1. **Coberturas No Categorizadas**: Se muestran como tarjetas sueltas sin agrupación semántica, sin aprovechar la información del tesauro (matchConfidence, canonicalName) que ya existe en el sistema. Los técnicos no pueden ver rápidamente qué categoría canónica sugiere el sistema ni comparar coberturas similares entre aseguradoras.

2. **Texto Completo de Deducibles**: Se presenta como bloques de texto plano sin estructura, sin aprovechar la función `parseDeductible()` que ya existe. Los técnicos deben leer texto completo para encontrar porcentajes y montos mínimos.

Según mejores prácticas de UX/UI para comparación de datos complejos (Context7/Tailwind CSS), las interfaces de comparación deben: usar sticky headers, agrupar información semánticamente, destacar diferencias, y proporcionar vistas jerárquicas (resumen + detalle).

## What Changes

- **Agrupación semántica de coberturas no categorizadas**: Agrupar por similitud usando el tesauro existente, mostrando matchConfidence y sugerencia de categoría canónica
- **Vista comparativa mejorada**: Permitir ver coberturas no categorizadas en formato matriz (columnas = aseguradoras) para facilitar comparación
- **Resumen estructurado de deducibles**: Extraer automáticamente porcentajes y montos mínimos del texto usando `parseDeductible()`
- **Vista jerárquica deducibles**: Resumen estructurado en tabla comparativa + texto completo colapsable
- **Mejoras visuales**: Usar sticky columns, badges de confianza, y color coding consistente

## Capabilities

### New Capabilities
- `uncategorized-coverage-grouping`: Agrupación semántica de coberturas no categorizadas usando tesauro
- `deductible-structured-summary`: Extracción y visualización estructurada de deducibles
- `comparison-view-toggle`: Toggle entre vistas agrupada y matriz para coberturas

### Modified Capabilities
- None

## Impact

- Components: `UnifiedCoverageMatrix.tsx`, `DeductiblesComparisonTable.tsx`, `ComparisonReport.tsx`
- Services: Reutiliza `parseDeductible()` y datos del tesauro existentes
- UX: Mejora significativa en velocidad de comparación técnica
- Zero breaking changes: Solo mejoras visuales y organizativas
