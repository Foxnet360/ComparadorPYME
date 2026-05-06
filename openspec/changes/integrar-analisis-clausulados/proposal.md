## Why

El proyecto tiene 1,647 líneas de código implementadas para análisis de clausulados que son completamente invisibles para los usuarios. Siete servicios backend, siete componentes React y seis endpoints API existen pero nunca se invocan desde el flujo principal. Los corredores de seguros no pueden ver validaciones de coberturas, análisis de riesgo de deducibles, contextualización por perfil ni asesoría legal porque estos servicios calculan datos pero nunca los exponen al frontend. Es necesario integrarlos en el flujo de análisis principal para hacer visibles las capacidades que ya están construidas.

## What Changes

### Integración Backend-Frontend
- Extender la respuesta de `/api/analyze` para incluir resultados de `clauseCoverageValidator` (validación de coberturas, conteo de phantom/missing)
- Agregar campos opcionales a `QuoteAnalysis` en `types.ts`: `clauseValidation`, `deductibleAnalysis`, `contextualRisk`
- Modificar `generateComparison()` en `analysisController.ts` para pasar `clauseValidationResults` al frontend

### Visualización en Dashboard Existente
- Reemplazar placeholders hardcodeados ("-") en `AuditDashboard.tsx` con datos reales de validación
- Mostrar métricas de coberturas verificadas/fantasma/omitidas cuando existan datos
- Mostrar métricas de riesgo de deducibles (bajo/medio/alto) por cotización

### Nueva Pestaña "Análisis Avanzado"
- Agregar pestaña `[Análisis Avanzado]` en `ComparisonReport.tsx` junto a Resumen/Coberturas/Deducibles/Auditoría
- Importar y renderizar componentes existentes:
  - `CoverageValidationMatrix` - Matriz de validación bidireccional
  - `DeductibleRiskGauge` - Gauges de riesgo por deducible
  - `ContextualExclusionCard` - Tarjetas de riesgo contextualizado
  - `WarrantyComplianceDashboard` - Dashboard de cumplimiento de garantías
  - `LegalOpinionCard` - Opiniones legales con puntos de negociación
  - `NegotiationPointsList` - Lista priorizada de puntos a negociar
  - `InverseCoverageAlert` - Alertas de coberturas omitidas

### Llamadas API Opcionales
- Crear hook `useAdvancedAnalysis` que llame endpoints `/api/analysis/*` después del análisis principal
- Llamadas condicionales basadas en disponibilidad de datos (no bloquear flujo principal)
- Feature flag `VITE_ENABLE_ADVANCED_ANALYSIS` para control gradual de rollout

### Correcciones de Schema
- **BREAKING**: Agregar columna `insurer_name` a tabla `documents` (o crear vista de mapeo) para que servicios puedan buscar por nombre de aseguradora
- Asegurar que tabla `clause_chunks` y funciones `match_clauses` existan en producción

## Capabilities

### New Capabilities
<!-- No se introducen capabilities nuevos; se integran los existentes -->
- *(Ninguno - este change es puramente de integración)*

### Modified Capabilities
- `clause-coverage-validation`: Requerimiento de integración - los resultados de validación DEBEN incluirse en la respuesta de `/api/analyze` y mostrarse en el reporte comparativo
- `deductible-risk-analysis`: Requerimiento de integración - el análisis de riesgo de deducibles DEBE visualizarse en el dashboard y reporte
- `contextual-risk-analysis`: Requerimiento de integración - las exclusiones contextualizadas DEBEN mostrarse cuando exista perfil de cliente
- `inverse-coverage-check`: Requerimiento de integración - las coberturas omitidas DEBEN alertarse en el reporte
- `warranty-compliance-analysis`: Requerimiento de integración - el análisis de cumplimiento DEBE mostrarse en la pestaña avanzada
- `virtual-lawyer-rag`: Requerimiento de integración - las opiniones legales DEBEN ser accesibles desde el reporte comparativo
- `clause-version-comparison`: Requerimiento de integración - la comparación de versiones DEBE estar disponible en la UI
- `comparison-report`: Requerimiento modificado - DEBE soportar nueva pestaña "Análisis Avanzado" y mostrar métricas de validación
- `risk-dashboard`: Requerimiento modificado - el dashboard DEBE mostrar métricas reales en vez de placeholders

## Impact

### Archivos Afectados
**Backend:**
- `server/src/controllers/analysisController.ts` - Extender respuesta con clauseValidationResults
- `server/src/services/clauseCoverageValidator.ts` - Fix schema queries (insurer_name vs insurer_id)
- `server/src/services/inverseCoverageChecker.ts` - Fix schema queries
- `server/src/services/clauseVersionComparator.ts` - Fix schema queries
- `server/src/types.ts` o crear extensiones de tipos

**Frontend:**
- `components/ComparisonReport.tsx` - Nueva pestaña, imports de componentes
- `components/AuditDashboard.tsx` - Conectar datos reales
- `types.ts` - Extender interfaces QuoteAnalysis y ComparisonReport
- Crear `hooks/useAdvancedAnalysis.ts` - Hook para llamadas API
- Crear `config/features.ts` - Feature flags

**Base de Datos:**
- `server/supabase/migrations/` - Agregar insurer_name a documents (si se elige Opción A)
- Verificar que `clause_chunks` y funciones `match_clauses` existan en producción

**Infraestructura:**
- Variables de entorno: `VITE_ENABLE_ADVANCED_ANALYSIS=true/false`

### APIs
- `POST /api/analyze` - Respuesta extendida (backward-compatible con campos opcionales)
- `POST /api/analysis/*` - Endpoints existentes, ahora llamados desde frontend

### Riesgos
- **Breaking potencial**: Cambio en schema de documents (agregar insurer_name)
- **Performance**: Llamadas API adicionales pueden ralentizar carga del reporte
- **Dependencias**: Requiere que tabla clause_chunks tenga datos para RAG funcional
