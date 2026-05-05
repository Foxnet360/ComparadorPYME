## Context

La visualización actual es funcional pero carece de:
- Jerarquía visual clara
- Indicadores de mejor opción
- Diferenciación cliente/técnico
- Resumen ejecutivo

## Goals / Non-Goals

**Goals:**
- Toggle Cliente/Técnico aplicado a TODO el reporte
- Winner indicators en matriz y deducibles
- Diff highlighting para diferencias significativas
- Executive summary con insights y navegación
- Severity bars para deducibles

**Non-Goals:**
- No modificar datos del backend
- No cambiar la estructura del reporte
- No agregar nuevas dependencias

## Decisions

### 1. Toggle Global
**Decisión:** Un toggle en el header afecta TODO el reporte
**Componentes afectados:**
- Matriz de Coberturas: Cliente (valores simples) vs Técnico (confidence, matchMethod)
- Deducibles: Cliente (severity simple) vs Técnico (detalles técnicos)
- Auditoría: Cliente (riesgos críticos solo) vs Técnico (todos los hallazgos)
- Dashboard: Cliente (gráficos simplificados) vs Técnico (todos los detalles)

### 2. Winner Indicator
**Criterios:**
- Mayor suma asegurada (parseando valores)
- Menor deducible
- Sin exclusiones
- Mejor score en esa categoría

### 3. Diff Highlighting
**Umbrales:**
- Rojo claro: Valor < 70% del promedio
- Verde claro: Valor > 130% del promedio
- Delta mostrado: "+15%" o "-20%"

### 4. Severity Bars
**Deducibles:**
- 0-30%: Verde (bajo)
- 30-60%: Amarillo (medio)
- 60-100%: Rojo (alto)
- Sobre valor asegurado: +20% penalty

## Risks / Trade-offs

**Riesgo:** Toggle confuso para usuarios
**Mitigación:** Labels claros "Vista Cliente" / "Vista Técnica", persistir preferencia

**Riesgo:** Winner indicator puede ser engañoso
**Mitigación:** Tooltip explicando el criterio, permitir override manual

**Riesgo:** Colores de diff pueden ser confusos
**Mitigación:** Leyenda explicativa, usar solo cuando hay >2 aseguradoras

## Migration Plan

1. Crear componentes base (ExecutiveSummary, CoverageMatrixEnhanced)
2. Modificar componentes existentes (toggle support)
3. Agregar winner/diff logic
4. Testing responsive

## Open Questions

1. ¿Debe persistir la preferencia de vista en localStorage?
2. ¿Qué tan detallado debe ser el executive summary?
