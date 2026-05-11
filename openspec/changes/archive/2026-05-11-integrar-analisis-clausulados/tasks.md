## 1. Preparación y Schema

- [x] 1.1 Crear vista `document_insurer_view` en Supabase para mapear insurer_id → insurer_name
- [x] 1.2 Verificar que tabla `clause_chunks` y funciones `match_clauses` existan en producción
- [x] 1.3 Agregar feature flag `VITE_ENABLE_ADVANCED_ANALYSIS` a variables de entorno
- [x] 1.4 Crear archivo `config/features.ts` con configuración de feature flags
- [x] 1.5 Extender tipos TypeScript: agregar campos opcionales a `QuoteAnalysis` y `ComparisonReport`

## 2. Backend - Integración en Respuesta

- [x] 2.1 Modificar `analysisController.ts` para pasar `clauseValidationResults` a `generateComparison()`
- [x] 2.2 Extender respuesta de `/api/analyze` con campos: `clauseValidation`, `deductibleAnalysis`, `contextualRisk`, `warrantyCompliance`, `legalOpinion`
- [x] 2.3 Implementar wrapper con try-catch y timeout (5s) para servicios de análisis avanzado
- [x] 2.4 Usar `Promise.allSettled` para llamar servicios en paralelo sin bloquear flujo principal
- [x] 2.5 Fix `clauseCoverageValidator.ts`: usar vista `document_insurer_view` o JOIN en queries
- [x] 2.6 Fix `inverseCoverageChecker.ts`: usar vista `document_insurer_view` o JOIN en queries
- [x] 2.7 Fix `clauseVersionComparator.ts`: usar vista `document_insurer_view` o JOIN en queries
- [x] 2.8 Agregar logs estructurados para monitorear performance de servicios integrados

## 3. Frontend - Dashboard Existente

- [x] 3.1 Conectar `AuditDashboard.tsx` a datos reales de `clauseValidation`
- [x] 3.2 Reemplazar placeholders "-" en métricas de validación con conteos reales
- [x] 3.3 Reemplazar placeholders "-" en métricas de deducibles con conteos reales
- [x] 3.4 Agregar condicionales: mostrar métricas solo cuando existan datos
- [x] 3.5 Agregar tooltips informativos cuando no hay datos disponibles
- [x] 3.6 Mantener backward compatibility: dashboard funciona sin datos avanzados

## 4. Frontend - Nueva Pestaña "Análisis Avanzado"

- [x] 4.1 Agregar estado `activeTab` para "analisis-avanzado" en `ComparisonReport.tsx`
- [x] 4.2 Agregar botón de pestaña condicional: solo visible cuando hay datos avanzados
- [x] 4.3 Importar `CoverageValidationMatrix` en `ComparisonReport.tsx`
- [x] 4.4 Importar `DeductibleRiskGauge` en `ComparisonReport.tsx`
- [x] 4.5 Importar `ContextualExclusionCard` en `ComparisonReport.tsx`
- [x] 4.6 Importar `WarrantyComplianceDashboard` en `ComparisonReport.tsx`
- [x] 4.7 Importar `LegalOpinionCard` en `ComparisonReport.tsx`
- [x] 4.8 Importar `NegotiationPointsList` en `ComparisonReport.tsx`
- [x] 4.9 Importar `InverseCoverageAlert` en `ComparisonReport.tsx`
- [x] 4.10 Renderizar componentes condicionalmente según disponibilidad de datos
- [x] 4.11 Agregar layout responsive para la pestaña (grid de 2 columnas en desktop)
- [x] 4.12 Agregar mensaje informativo cuando no hay datos de un tipo específico

## 5. Frontend - Hook de Llamadas API

- [x] 5.1 Crear `hooks/useAdvancedAnalysis.ts`
- [x] 5.2 Implementar llamada a `/api/analysis/deductible-risk` con datos de la cotización
- [x] 5.3 Implementar llamada a `/api/analysis/contextualize` con exclusiones y perfil
- [x] 5.4 Implementar llamada a `/api/analysis/warranty-compliance` con condiciones
- [x] 5.5 Implementar llamada a `/api/analysis/legal-opinion` con cotización y perfil
- [x] 5.6 Implementar llamada a `/api/analysis/inverse-check` con cotización
- [x] 5.7 Manejar estados de carga (loading) y error gracefulmente
- [x] 5.8 Usar `Promise.allSettled` para llamadas en paralelo
- [x] 5.9 Implementar retry con backoff exponencial para fallos temporales
- [x] 5.10 Cachear resultados por (quoteHash, analysisType) para evitar re-llamadas

## 6. Backend - Correcciones de Schema

- [x] 6.1 Ejecutar migración: crear vista `document_insurer_view` en Supabase
- [x] 6.2 Verificar que `clause_chunks` tenga datos para aseguradoras principales
- [x] 6.3 Si no hay datos en `clause_chunks`, ejecutar script de seed con clausulados base
- [x] 6.4 Documentar en `DEPLOY.md` la necesidad de seedear clausulados

## 7. Testing

- [x] 7.1 Escribir test unitario para `generateComparison()` con datos de validación
- [x] 7.2 Escribir test de integración para `/api/analyze` con respuesta extendida
- [x] 7.3 Verificar que `AuditDashboard` renderiza correctamente con y sin datos avanzados
- [x] 7.4 Verificar que pestaña "Análisis Avanzado" solo aparece cuando hay datos
- [x] 7.5 Testear feature flag: cuando `VITE_ENABLE_ADVANCED_ANALYSIS=false`, no se muestra UI
- [x] 7.6 Testear performance: `/api/analyze` no debe tardar más de 2s adicionales
- [x] 7.7 Verificar backward compatibility: clientes antiguos ignoran campos nuevos

## 8. Rollout y Monitoreo

- [x] 8.1 Deploy a staging con feature flag `VITE_ENABLE_ADVANCED_ANALYSIS=false`
- [x] 8.2 Activar flag en staging para testing interno
- [x] 8.3 Monitorear logs de errores en `/api/analyze`
- [x] 8.4 Medir tiempo de respuesta del endpoint con análisis avanzado
- [x] 8.5 Activar flag para 10% de usuarios en producción
- [x] 8.6 Monitorear métricas de uso y errores durante 48 horas
- [x] 8.7 Aumentar a 50% de usuarios si no hay errores críticos
- [x] 8.8 Aumentar a 100% de usuarios después de una semana estable
- [x] 8.9 Documentar rollback procedure: cambiar flag a false en Railway Dashboard

## 9. Documentación

- [x] 9.1 Actualizar `API.md` con campos nuevos en respuesta de `/api/analyze`
- [x] 9.2 Documentar feature flags en `DEPLOY.md`
- [x] 9.3 Crear guía para corredores: "Cómo interpretar el Análisis Avanzado"
- [x] 9.4 Documentar schema de base de datos: vista `document_insurer_view`
- [x] 9.5 Actualizar `README.md` con nuevas capacidades visibles
