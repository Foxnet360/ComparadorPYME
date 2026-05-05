# Proposal: Fortalecer Análisis con Clausulados

## Why

El sistema actual trata los clausulados como datos **opcionales** en el análisis de cotizaciones. Cuando no hay clausulados indexados para una aseguradora, las dimensiones de exclusions, sublimits, warranties y deductibles caen a 50/100 (neutral), lo que significa que el sistema **no penaliza la ausencia de clausulados** y simplemente ignora el riesgo. Esto permite que coberturas "fantasma" (ofrecidas en cotización pero no contempladas en clausulado) pasen desapercibidas, y que exclusiones críticas no sean contextualizadas para el perfil específico del cliente.

Este cambio transforma los clausulados de **referencia opcional** a **validación obligatoria**, introduciendo 7 nuevas capacidades de análisis que aumentan la profundidad y precisión del auditoría de riesgos.

## What Changes

- **Hacer clausulados obligatorios en scoring**: Penalizar ausencia de clausulados en lugar de asignar score neutral (50/100)
- **Validación bidireccional de coberturas**: Verificar que coberturas en cotización existan en clausulado (y viceversa)
- **Análisis de riesgo de deducibles**: Calcular deducible real vs suma asegurada, detectar topes y proporciones
- **Contextualización de exclusiones**: Cruzar exclusiones del clausulado con perfil del cliente (industria, ubicación, etc.)
- **Análisis de condiciones de cumplimiento**: Clasificar garantías por tipo (documental/operacional/técnica/financiera) y dificultad
- **Comparativa de versiones de clausulados**: Detectar cambios contractuales entre versiones
- **RAG como abogado virtual**: Generar opiniones legales contextualizadas usando cotización + clausulado + perfil de cliente

## Capabilities

### New Capabilities
- `clause-coverage-validation`: Validar existencia de coberturas en clausulado (bidireccional: quote → clause y clause → quote)
- `deductible-risk-analysis`: Analizar deducibles considerando suma asegurada, topes máximos, y proporción de riesgo
- `inverse-coverage-check`: Detectar coberturas obligatorias en clausulado que fueron omitidas en cotización
- `clause-version-comparison`: Comparar versiones de clausulados para detectar cambios contractuales
- `contextual-risk-analysis`: Contextualizar exclusiones y riesgos según perfil del cliente (industria, ubicación, etc.)
- `warranty-compliance-analysis`: Analizar condiciones de cumplimiento por tipo y dificultad, calcular riesgo de incumplimiento
- `virtual-lawyer-rag`: Generar opiniones legales enriquecidas combinando RAG + perfil de cliente

### Modified Capabilities
- `rule-based-scoring`: Los clausulados ya no son opcionales. La ausencia de clausulados penaliza el score (30/100 en lugar de 50/100). Nueva dimensión: validación de existencia de coberturas.
- `coverage-cross-reference`: Extender para soportar validación bidireccional (quote ↔ clausulado) en lugar de solo deducible vs deducible.
- `rag-audit-enrichment`: Enriquecer alertas con contexto del cliente, no solo contexto genérico por industria.
- `risk-dashboard`: Agregar métricas de coberturas fantasma, riesgo de deducibles, y condiciones de cumplimiento.

## Impact

**Backend:**
- Nuevos servicios: `clauseCoverageValidator.ts`, `deductibleAnalyzer.ts`, `inverseCoverageChecker.ts`, `clauseVersionComparator.ts`, `contextualRiskAnalyzer.ts`, `warrantyComplianceAnalyzer.ts`, `virtualLawyerService.ts`
- Modificación de: `quoteScorer.ts`, `crossReferenceEngine.ts`, `auditEnrichmentService.ts`
- Nuevos endpoints API: `/api/analysis/validate-coverages`, `/api/analysis/deductible-risk`, `/api/analysis/inverse-check`, `/api/analysis/contextualize`, `/api/analysis/legal-opinion`

**Base de datos:**
- Nuevas tablas: `client_profiles`, `clause_coverages`, `clause_versions`, `contextual_risk_analysis`
- Nueva columna en `documents`: `parent_document_id`, `change_summary`

**Frontend:**
- Nuevos componentes: `CoverageValidationMatrix.tsx`, `DeductibleRiskGauge.tsx`, `ContextualExclusionCard.tsx`, `WarrantyComplianceDashboard.tsx`
- Modificación de: `AuditDashboard.tsx`, `AuditSection.tsx`, `ComparisonReport.tsx`

**Riesgos:**
- **Regresión en scoring**: Tests exhaustivos requeridos para mantener consistencia
- **Performance**: Lazy loading y caché necesarios para no exceder 30s por análisis
- **Dependencia de Gemini**: Prompts versionados y fallback a análisis quote-only si falla extracción de clausulado

## Fases de Implementación

| Fase | Branch | Capabilities | Duración Est. |
|------|--------|-------------|---------------|
| Fase 1 | `feature/f1-coverage-validation` | clause-coverage-validation + rule-based-scoring modificado | 2-3 semanas |
| Fase 2 | `feature/f2-deductible-risk` | deductible-risk-analysis, inverse-coverage-check, clause-version-comparison | 3-4 semanas |
| Fase 3 | `feature/f3-contextual-risk` | contextual-risk-analysis, warranty-compliance-analysis | 4-5 semanas |
| Fase 4 | `feature/f4-virtual-lawyer` | virtual-lawyer-rag | 5-6 semanas |

**Nota:** Este change es la **rama contenedora** (`feature/fortalecer-analisis-clausulados`). Las fases se implementan en sub-branches que se mergean a esta rama. No se hará deploy a `main` hasta que todas las fases estén completas y validadas.
