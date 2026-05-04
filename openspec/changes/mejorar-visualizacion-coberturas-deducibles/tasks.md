## 1. Implementar agrupación semántica de coberturas no categorizadas

- [x] 1.1 Crear función `groupUncategorizedBySemanticSimilarity()` en UnifiedCoverageMatrix
- [x] 1.2 Agrupar por `canonicalName` sugerido, fallback a "Sin clasificar"
- [x] 1.3 Crear componente visual de grupo con título y contador
- [x] 1.4 Mostrar badge de matchConfidence con color coding
- [x] 1.5 Mostrar método de matching (tesauro, fuzzy, embedding, llm)

## 2. Implementar toggle de vistas (Agrupada vs Matriz)

- [x] 2.1 Agregar estado `viewMode` ('grouped' | 'matrix') en UnifiedCoverageMatrix
- [x] 2.2 Crear componente de toggle UI (botones o tabs)
- [x] 2.3 Implementar vista agrupada con cards por grupo
- [x] 2.4 Implementar vista matriz con tabla comparativa
- [x] 2.5 Agregar sticky columns a la vista matriz

## 3. Mejorar visualización de coberturas no categorizadas

- [x] 3.1 Mostrar nombre original vs canónico cuando difieran
- [x] 3.2 Agregar tooltip con información completa de matching
- [x] 3.3 Mejorar estilos visuales con Tailwind (sombras, bordes, espaciado)
- [x] 3.4 Agregar iconos indicadores (AlertTriangle, CheckCircle) según confianza

## 4. Implementar resumen estructurado de deducibles

- [ ] 4.1 Crear componente `DeductibleSummaryTable` nuevo
- [ ] 4.2 Usar `parseDeductible()` para extraer datos de cada cobertura
- [ ] 4.3 Crear tabla comparativa con categorías como filas y aseguradoras como columnas
- [ ] 4.4 Destacar visualmente diferencias entre aseguradoras
- [ ] 4.5 Agregar indicadores de tipo (sobre pérdida vs sobre valor)

## 5. Implementar texto completo colapsable

- [x] 5.1 Agregar estado `expanded` por aseguradora en DeductiblesComparisonTable
- [x] 5.2 Crear componente `CollapsibleText` reutilizable
- [x] 5.3 Mostrar texto completo solo cuando se expande
- [x] 5.4 Preservar formato original (whitespace-pre-line)
- [x] 5.5 Agregar animación suave de expandir/colapsar

## 6. Mejorar UX/UI general

- [ ] 6.1 Agregar sticky headers a todas las tablas comparativas
- [ ] 6.2 Implementar responsive design para mobile (<768px)
- [ ] 6.3 Mejorar color coding consistente (usar mismo sistema en coberturas y deducibles)
- [ ] 6.4 Agregar tooltips informativos en headers y badges
- [ ] 6.5 Implementar scroll horizontal suave con indicadores visuales

## 7. Verificación y testing

- [x] 7.1 Verificar build sin errores (`npm run build`)
- [ ] 7.2 Testear con datos de ejemplo (coberturas con y sin canonicalName)
- [ ] 7.3 Testear responsive en diferentes tamaños de pantalla
- [ ] 7.4 Verificar que la información del tesauro se muestra correctamente
- [ ] 7.5 Verificar que parseDeductible funciona con textos reales
