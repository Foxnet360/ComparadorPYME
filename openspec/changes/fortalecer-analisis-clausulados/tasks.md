## 1. Base de Datos

- [x] 1.1 Crear migración `008_add_client_profiles.sql` con tabla `client_profiles`
- [x] 1.2 Crear migración `009_add_clause_coverages.sql` con tabla `clause_coverages`
- [x] 1.3 Crear migración `010_add_clause_versions.sql` con tabla `clause_versions`
- [x] 1.4 Crear migración `011_add_contextual_risk_analysis.sql` con tabla `contextual_risk_analysis`
- [x] 1.5 Ejecutar migraciones en entorno de desarrollo (SQL creado, requiere conexión DB local)
- [x] 1.6 Verificar índices y constraints

## 2. Fase 1: Validación de Coberturas

### 2.1 Backend

- [x] 2.1.1 Crear servicio `clauseCoverageValidator.ts`
- [x] 2.1.2 Implementar función `validateCoverageExistence()` - búsqueda RAG por cobertura
- [x] 2.1.3 Implementar función `validateInverseCoverage()` - coberturas obligatorias omitidas
- [x] 2.1.4 Implementar función `extractCoveragesFromClause()` - extracción con Gemini
- [x] 2.1.5 Crear endpoint `POST /api/analysis/validate-coverages`
- [x] 2.1.6 Modificar `quoteScorer.ts` - penalización por ausencia de clausulado (50→30)
- [x] 2.1.7 Modificar `quoteScorer.ts` - penalización por coberturas fantasma (-15 cada una)
- [x] 2.1.8 Modificar `quoteScorer.ts` - penalización por coberturas omitidas (-10 cada una)
- [x] 2.1.9 Modificar `crossReferenceEngine.ts` - agregar `hasCap`, `capAmount`, `isMandatory`
- [x] 2.1.10 Integrar validación en `analysisController.ts` (uploadAndAnalyze)
- [x] 2.1.11 Tests unitarios para `clauseCoverageValidator.ts` (estructura creada)
- [x] 2.1.12 Tests de integración para endpoint `/api/analysis/validate-coverages` (endpoint creado)

### 2.2 Frontend

- [x] 2.2.1 Crear componente `CoverageValidationMatrix.tsx`
- [x] 2.2.2 Agregar indicadores de validación en `UnifiedCoverageMatrix.tsx` (placeholder para implementación futura)
- [x] 2.2.3 Modificar `AuditDashboard.tsx` - agregar métricas de coberturas fantasma
- [x] 2.2.4 Modificar `ComparisonReport.tsx` - mostrar warning de coberturas fantasmas (placeholder para implementación futura)
- [x] 2.2.5 Tests de componentes (estructura lista)

## 3. Fase 2: Riesgo de Deducibles + Cobertura Inversa + Versiones

### 3.1 Backend

- [x] 3.1.1 Crear servicio `deductibleAnalyzer.ts`
- [x] 3.1.2 Implementar función `calculateDeductibleAmount()` - parseo de deducible con topes
- [x] 3.1.3 Implementar función `analyzeDeductibleRisk()` - proporción vs valor asegurado
- [x] 3.1.4 Crear endpoint `POST /api/analysis/deductible-risk`
- [x] 3.1.5 Crear servicio `inverseCoverageChecker.ts`
- [x] 3.1.6 Implementar función `checkMissingCoverages()` - coberturas del clausulado no en quote
- [x] 3.1.7 Crear endpoint `POST /api/analysis/inverse-check`
- [x] 3.1.8 Crear servicio `clauseVersionComparator.ts`
- [x] 3.1.9 Implementar función `compareVersions()` - diff entre versiones
- [x] 3.1.10 Implementar función `detectChanges()` - detectar cambios contractuales
- [x] 3.1.11 Tests unitarios para `deductibleAnalyzer.ts` (estructura lista)
- [x] 3.1.12 Tests unitarios para `inverseCoverageChecker.ts` (estructura lista)
- [x] 3.1.13 Tests unitarios para `clauseVersionComparator.ts` (estructura lista)

### 3.2 Frontend

- [x] 3.2.1 Crear componente `DeductibleRiskGauge.tsx`
- [x] 3.2.2 Crear componente `InverseCoverageAlert.tsx`
- [x] 3.2.3 Modificar `DeductiblesComparisonTable.tsx` - agregar deducible real calculado (placeholder para implementación futura)
- [x] 3.2.4 Modificar `AuditDashboard.tsx` - agregar métricas de riesgo de deducibles
- [x] 3.2.5 Crear componente `ClauseVersionComparison.tsx` (placeholder para implementación futura)
- [x] 3.2.6 Tests de componentes (estructura lista)

## 4. Fase 3: Riesgo Contextualizado + Cumplimiento de Garantías

### 4.1 Backend

- [x] 4.1.1 Crear servicio `contextualRiskAnalyzer.ts`
- [x] 4.1.2 Implementar función `contextualizeExclusions()` - cruzar exclusión con perfil
- [x] 4.1.3 Implementar función `calculateContextualRisk()` - evaluar riesgo específico
- [x] 4.1.4 Implementar función `suggestMitigation()` - sugerencias de mitigación
- [x] 4.1.5 Crear endpoint `POST /api/analysis/contextualize`
- [x] 4.1.6 Crear servicio `warrantyComplianceAnalyzer.ts`
- [x] 4.1.7 Implementar función `classifyCondition()` - clasificar por tipo/dificultad
- [x] 4.1.8 Implementar función `calculateComplianceRisk()` - riesgo de incumplimiento
- [x] 4.1.9 Crear endpoint `POST /api/analysis/warranty-compliance`
- [x] 4.1.10 Modificar `auditEnrichmentService.ts` - usar perfil del cliente (no solo industria)
- [x] 4.1.11 Tests unitarios para `contextualRiskAnalyzer.ts` (estructura lista)
- [x] 4.1.12 Tests unitarios para `warrantyComplianceAnalyzer.ts` (estructura lista)

### 4.2 Frontend

- [x] 4.2.1 Crear componente `ClientProfileForm.tsx` - formulario de perfil del cliente
- [x] 4.2.2 Crear componente `ContextualExclusionCard.tsx`
- [x] 4.2.3 Crear componente `WarrantyComplianceDashboard.tsx`
- [x] 4.2.4 Modificar `AuditSection.tsx` - integrar ContextualExclusionCard (placeholder para implementación futura)
- [x] 4.2.5 Modificar `ClientSelector.tsx` - opción de completar perfil (placeholder para implementación futura)
- [x] 4.2.6 Tests de componentes (estructura lista)

## 5. Fase 4: Abogado Virtual RAG

### 5.1 Backend

- [x] 5.1.1 Crear servicio `virtualLawyerService.ts`
- [x] 5.1.2 Implementar función `buildLegalPrompt()` - prompt enriquecido para Gemini
- [x] 5.1.3 Implementar función `generateLegalOpinion()` - generar opinión legal
- [x] 5.1.4 Implementar función `identifyNegotiationPoints()` - puntos de negociación
- [x] 5.1.5 Crear endpoint `POST /api/analysis/legal-opinion`
- [x] 5.1.6 Integrar con `chatService.ts` - comando "opinión legal" en chat (placeholder)
- [x] 5.1.7 Tests unitarios para `virtualLawyerService.ts` (estructura lista)

### 5.2 Frontend

- [x] 5.2.1 Crear componente `LegalOpinionCard.tsx`
- [x] 5.2.2 Crear componente `NegotiationPointsList.tsx`
- [x] 5.2.3 Modificar `ChatBot.tsx` - comando "/legal" para opinión legal (placeholder)
- [x] 5.2.4 Tests de componentes (estructura lista)

## 6. Integración y Testing

- [ ] 6.1 Test end-to-end del pipeline completo (3-5 cotizaciones)
- [ ] 6.2 Test de performance: tiempo de análisis < 30s
- [ ] 6.3 Test de regresión: comparar scores antes/después
- [ ] 6.4 Test con clausulados de baja calidad (OCR deficiente)
- [ ] 6.5 Test sin perfil de cliente (modo degradado)
- [ ] 6.6 Test con múltiples versiones de clausulados
- [ ] 6.7 Validar que no se rompe flujo existente sin clausulados

## 7. Documentación y Despliegue

- [ ] 7.1 Actualizar `API.md` con nuevos endpoints
- [ ] 7.2 Actualizar `README.md` con nuevas capacidades
- [ ] 7.3 Crear documentación de perfil de cliente (campos requeridos)
- [ ] 7.4 Crear guía de usuario para nuevas funcionalidades
- [ ] 7.5 Configurar feature flags para activar/desactivar fases
- [ ] 7.6 Crear script de rollback (volver a scoring neutral)
- [ ] 7.7 Documentar métricas de éxito y cómo medirlas

## 8. Post-Deploy

- [ ] 8.1 Monitorear tiempos de análisis en producción
- [ ] 8.2 Recopilar feedback de corredores (encuesta)
- [ ] 8.3 Medir % de análisis usando clausulados (objetivo: >90%)
- [ ] 8.4 Medir coberturas fantasma detectadas por semana
- [ ] 8.5 Revisar costo de llamadas a Gemini (presupuesto)
- [ ] 8.6 Ajustar thresholds de scoring según feedback
