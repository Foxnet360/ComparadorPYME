# Plan de Ramas: Fortalecer Análisis con Clausulados

## Estructura de Ramas

```
main (protegida, deploy)
│
└── feature/fortalecer-analisis-clausulados  ← Rama contenedora (ESTÁS AQUÍ)
    │
    ├── feature/f1-coverage-validation     ← Fase 1: Validación de coberturas
    │   └── merge → feature/fortalecer...
    │
    ├── feature/f2-deductible-risk         ← Fase 2: Riesgo de deducibles + inversa + versiones
    │   └── merge → feature/fortalecer...
    │
    ├── feature/f3-contextual-risk         ← Fase 3: Riesgo contextualizado + cumplimiento
    │   └── merge → feature/fortalecer...
    │
    └── feature/f4-virtual-lawyer          ← Fase 4: Abogado virtual RAG
        └── merge → feature/fortalecer...

    (Cuando todas las fases estén listas y validadas)
    └── PR → main (manual, cuando decidas deploy)
```

## Reglas de la Rama

1. **NO se hace merge a `main`** sin aprobación explícita
2. **NO se hace deploy** automático de esta rama
3. Cada fase se prueba independientemente en su sub-rama
4. Solo se mergean fases completadas y testeadas a la rama contenedora
5. La rama contenedora mantiene OpenSpec actualizado

## Artifacts OpenSpec

| Artifact | Estado | Archivo |
|----------|--------|---------|
| Proposal | ✅ Completo | `openspec/changes/fortalecer-analisis-clausulados/proposal.md` |
| Specs | ✅ Completo | `openspec/changes/fortalecer-analisis-clausulados/specs/` |
| Design | ✅ Completo | `openspec/changes/fortalecer-analisis-clausulados/design.md` |
| Tasks | ✅ Completo | `openspec/changes/fortalecer-analisis-clausulados/tasks.md` |

## Fases de Implementación

### Fase 1: Validación de Coberturas (2-3 semanas)
**Rama:** `feature/f1-coverage-validation`
**Specs:**
- `clause-coverage-validation.md`
- `rule-based-scoring-delta.md`
- `coverage-cross-reference-delta.md`

**Servicios nuevos:**
- `clauseCoverageValidator.ts`

**Modificaciones:**
- `quoteScorer.ts` (penalizaciones)
- `crossReferenceEngine.ts` (datos extendidos)
- `analysisController.ts` (integración)

**Endpoints nuevos:**
- `POST /api/analysis/validate-coverages`

**Componentes nuevos:**
- `CoverageValidationMatrix.tsx`

**Tests:**
- Unitarios: `clauseCoverageValidator.ts`
- Integración: endpoint `/api/analysis/validate-coverages`
- Regresión: scoring antes/después

### Fase 2: Riesgo de Deducibles + Inversa + Versiones (3-4 semanas)
**Rama:** `feature/f2-deductible-risk`
**Specs:**
- `deductible-risk-analysis.md`
- `inverse-coverage-check.md`
- `clause-version-comparison.md`

**Servicios nuevos:**
- `deductibleAnalyzer.ts`
- `inverseCoverageChecker.ts`
- `clauseVersionComparator.ts`

**Endpoints nuevos:**
- `POST /api/analysis/deductible-risk`
- `POST /api/analysis/inverse-check`

**Componentes nuevos:**
- `DeductibleRiskGauge.tsx`
- `InverseCoverageAlert.tsx`
- `ClauseVersionComparison.tsx`

**Tests:**
- Unitarios para cada servicio
- Integración de endpoints

### Fase 3: Riesgo Contextualizado + Cumplimiento (4-5 semanas)
**Rama:** `feature/f3-contextual-risk`
**Specs:**
- `contextual-risk-analysis.md`
- `warranty-compliance-analysis.md`
- `rag-audit-enrichment-delta.md`
- `risk-dashboard-delta.md`

**Servicios nuevos:**
- `contextualRiskAnalyzer.ts`
- `warrantyComplianceAnalyzer.ts`

**Modificaciones:**
- `auditEnrichmentService.ts` (perfil del cliente)

**Endpoints nuevos:**
- `POST /api/analysis/contextualize`
- `POST /api/analysis/warranty-compliance`

**Componentes nuevos:**
- `ClientProfileForm.tsx`
- `ContextualExclusionCard.tsx`
- `WarrantyComplianceDashboard.tsx`

**Tests:**
- Unitarios para cada servicio
- Test de modo degradado (sin perfil)

### Fase 4: Abogado Virtual RAG (5-6 semanas)
**Rama:** `feature/f4-virtual-lawyer`
**Specs:**
- `virtual-lawyer-rag.md`

**Servicios nuevos:**
- `virtualLawyerService.ts`

**Endpoints nuevos:**
- `POST /api/analysis/legal-opinion`

**Componentes nuevos:**
- `LegalOpinionCard.tsx`
- `NegotiationPointsList.tsx`

**Integraciones:**
- `chatService.ts` (comando "/legal")

**Tests:**
- Unitarios para `virtualLawyerService.ts`
- Test de costo/presupuesto

## Checklist de Inicio de Cada Fase

Antes de empezar cada fase:
- [ ] Leer spec correspondiente
- [ ] Leer sección de Design relacionada
- [ ] Crear rama desde `feature/fortalecer-analisis-clausulados`
- [ ] Ejecutar tests existentes (asegurar que pasan)
- [ ] Revisar tasks de la fase en `tasks.md`

## Checklist de Finalización de Cada Fase

Antes de mergear a rama contenedora:
- [ ] Todos los tests pasan
- [ ] Code review completado
- [ ] Documentación actualizada
- [ ] Performance validada (tiempo < 30s)
- [ ] Sin regresiones en scoring existente
- [ ] OpenSpec actualizado si hay cambios

## Métricas de Éxito (Post-Deploy)

1. **Cobertura de clausulados:** % de análisis con clausulados > 90%
2. **Coberturas fantasma detectadas:** > 0 por semana (objetivo: detectar 100%)
3. **Tiempo de análisis:** < 30 segundos para 3-5 cotizaciones
4. **Score de confianza:** No debe bajar en promedio
5. **Satisfacción del corredor:** > 4.5/5

## Rollback

Si es necesario rollback:
1. Revertir PR de `feature/fortalecer-analisis-clausulados` → `main`
2. Las tablas nuevas no afectan datos existentes (son adicionales)
3. Scoring vuelve a neutral (50/100) automáticamente
4. No hay pérdida de datos históricos

## Comandos Útiles

```bash
# Ver estado del change
openspec status --change fortalecer-analisis-clausulados

# Crear nueva fase
git checkout feature/fortalecer-analisis-clausulados
git checkout -b feature/f1-coverage-validation

# Mergear fase completada
git checkout feature/fortalecer-analisis-clausulados
git merge feature/f1-coverage-validation

# Verificar tests
npm test

# Ejecutar linter
npm run lint
```
