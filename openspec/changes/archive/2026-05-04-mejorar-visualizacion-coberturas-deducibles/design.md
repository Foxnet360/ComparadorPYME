## Context

El sistema actual tiene toda la información necesaria para una mejor visualización, pero no la está usando:

1. **Tesauro**: Ya existe `matchConfidence`, `canonicalName`, `matchMethod` en cada cobertura
2. **Parser de deducibles**: Ya existe `parseDeductible()` que extrae porcentajes, mínimos y tipo
3. **Tailwind CSS**: Ya está configurado con utilidades para sticky, grid, flex, etc.

Basado en mejores prácticas de Context7 (Tailwind CSS docs):
- Tablas con `sticky` headers mejoran la navegación en datos largos
- `overflow-auto` + `min-w-full` permite scroll horizontal responsivo
- Agrupación visual con `divide-y` y bordes sutiles reduce carga cognitiva
- Cards con `backdrop-blur` y sombras crean jerarquía visual

## Goals / Non-Goals

**Goals:**
- Agrupar coberturas no categorizadas por similitud semántica (usando canonicalName sugerido)
- Mostrar métricas de confianza (matchConfidence) de forma visual
- Crear resumen estructurado de deducibles con datos extraídos automáticamente
- Mantener texto original accesible pero colapsable
- Facilitar comparación lado-a-lado entre aseguradoras

**Non-Goals:**
- No modificar la lógica de extracción de datos (Gemini/tesauro)
- No cambiar el modelo de datos existente
- No crear nuevas dependencias

## Decisions

1. **Agrupación por canonicalName sugerido**
   - Usar el campo `canonicalName` (ya existe) para agrupar coberturas no categorizadas
   - Si no hay canonicalName, agrupar bajo "Sin clasificar"
   - Rationale: Aprovecha la inteligencia semántica ya existente

2. **Vista dual: Agrupada vs Matriz**
   - Toggle entre vista agrupada (mejor para entender) y vista matriz (mejor para comparar)
   - Rationale: Diferentes técnicos prefieren diferentes vistas según su tarea

3. **Resumen de deducibles como tabla comparativa**
   - Extraer datos con `parseDeductible()` y mostrar en tabla lado-a-lado
   - Texto completo colapsable debajo
   - Rationale: Los técnicos necesitan comparar rápidamente, no leer texto

4. **Sticky columns para tablas comparativas**
   - Usar `sticky left-0` para la columna de categorías/nombres
   - Rationale: Mejora la navegación cuando hay muchas aseguradoras (Context7)

5. **Badges de confianza con color coding**
   - Verde (>90%), Amarillo (70-90%), Rojo (<70%)
   - Rationale: Información crítica visible a simple vista

## Risks / Trade-offs

- [Risk] Tablas con sticky columns pueden tener issues en mobile → [Mitigation] Usar `overflow-x-auto` y breakpoints responsivos
- [Risk] Agrupación por canonicalName puede no ser perfecta → [Mitigation] Mostrar matchConfidence y permitir vista alternativa
- [Risk] Extracción de deducibles puede fallar en textos complejos → [Mitigation] Fallback al texto original siempre visible

## Migration Plan

No migration needed. Pure UI enhancement.

## Open Questions

None. Scope is well-defined based on existing code analysis.
