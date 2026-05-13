## 1. Fix RAG Schema Error

- [x] 1.1 Modify `server/src/services/ragRetrievalService.ts`: Change `checkInsurerHasClauses()` to query `clause_chunks` table instead of `chunks`
- [x] 1.2 Add fallback logic: if `clause_chunks` is empty, check `documents` table for clause documents
- [x] 1.3 Modify `server/src/services/auditEnrichmentService.ts`: Update `checkClausesAvailability()` to use correct table
- [x] 1.4 Test RAG pre-flight check with existing insurers (HDI, SBS, MAPFRE)
  > **Nota**: Testing completo re-scoped a `fix-rag-precision-visualization-audit` (tasks 8.1-8.7)

## 2. Replace DeductibleGauge with DeductibleBadge

- [x] 2.1 Create `components/DeductibleBadge.tsx`: Compact inline badge (8px colored dot + text)
- [x] 2.2 Implement color logic: green (no deductible), yellow (1-10%), red (>10% or unspecified)
- [x] 2.3 Add tooltip with full deductible text and recommendation
- [x] 2.4 Replace DeductibleGauge usage in `components/UnifiedCoverageMatrix.tsx` (main matrix)
- [x] 2.5 Replace DeductibleGauge usage in uncategorized coverages section
- [x] 2.6 Deprecate or remove `components/DeductibleGauge.tsx`

## 3. Fix Uncategorized Coverage Matrix

- [ ] 3.1 Modify `components/UnifiedCoverageMatrix.tsx`: Implement true N×M matrix for uncategorized view
- [ ] 3.2 Create rows: unique coverages across all insurers
- [ ] 3.3 Create columns: all insurers
- [ ] 3.4 Populate cells: value for each coverage/insurer pair, "—" if missing
- [ ] 3.5 Add "Exclusiva" badge for coverage only offered by one insurer
- [ ] 3.6 Test with 2+ insurers (Pachito-el-chef example)

> **Nota**: Tasks 3.1-3.6 re-scoped a `fix-rag-precision-visualization-audit` (task 5.1)

## 4. Create Quote-Based Audit Service

- [x] 4.1 Create `server/src/services/quoteBasedAuditor.ts`: Analyze deductibles from quote data
- [x] 4.2 Implement missing coverage detection against 14 canonical categories
- [x] 4.3 Implement deductible risk scoring (LOW/MEDIUM/HIGH/CRITICAL)
- [x] 4.4 Implement cross-insurer deductible comparison
- [x] 4.5 Integrate quoteBasedAuditor into `analysisController.ts` response
- [x] 4.6 Add audit results to `QuoteAnalysis` type/interface

## 5. Create Deductible Matrix Component

- [ ] 5.1 Create `components/DeductibleMatrix.tsx`: Structured matrix with 14 rows × N insurers
- [ ] 5.2 Display columns: Suma Asegurada | Deducible | Sublímite
- [ ] 5.3 Implement color coding by risk level
- [ ] 5.4 Add summary panel: best/worst deductible per coverage
- [ ] 5.5 Add negotiation recommendations
- [ ] 5.6 Integrate into `ComparisonReport.tsx` deducibles tab

> **Nota**: Tasks 5.1-5.6 re-scoped a `fix-rag-precision-visualization-audit` (task 5.7)

## 6. Extract Special Conditions from Quotes

- [ ] 6.1 Modify `server/src/services/quoteParser.ts`: Add specialConditions extraction from raw text
- [ ] 6.2 Implement regex patterns for: "Condición especial:", "Nota:", "Excluye:", "Sujeto a:"
- [ ] 6.3 Classify conditions by impact: CRITICAL/WARNING/INFO
- [ ] 6.4 Add specialConditions to `ParsedQuote` interface
- [ ] 6.5 Display conditions in audit section grouped by insurer

> **Nota**: Tasks 6.1-6.5 re-scoped a `fix-rag-precision-visualization-audit` (task 4.8)

## 7. Optimize Semantic Matching Performance

- [ ] 7.1 Modify `server/src/services/semanticMatcher.ts`: Implement batch embedding generation
- [ ] 7.2 Add fuzzy matching first (skip LLM if confidence > 0.8)
- [ ] 7.3 Cache embeddings for 24h to avoid regeneration
- [ ] 7.4 Test performance: target <60s for 2 quotes (vs current 170s)

> **Nota**: Tasks 7.1-7.4 re-scoped a `fix-rag-precision-visualization-audit` (task 1.11)

## 8. Fix Charts in Hidden Tabs

- [ ] 8.1 Fix Recharts error when container has 0 dimensions
- [ ] 8.2 Use conditional rendering or ResizeObserver for charts in tabs
- [ ] 8.3 Test radar chart and heatmap in audit section tabs

> **Nota**: Tasks 8.1-8.3 re-scoped a `fix-rag-precision-visualization-audit` (task 5.8)

## 9. Update Frontend Integration

- [x] 9.1 Modify `components/AuditSection.tsx`: Display quote-based analysis when RAG unavailable
- [x] 9.2 Add label: "Análisis basado en datos de cotización" vs "Enriquecido con clausulados"
- [x] 9.3 Integrate deductible analysis into audit alerts
- [x] 9.4 Add missing coverage alerts to audit section
- [ ] 9.5 Test audit section with no clauses indexed
  
> **Nota**: Re-scoped a `fix-rag-precision-visualization-audit` (task 8.3)

## 10. Testing and Validation

- [ ] 10.1 Test with Pachito-el-chef example (HDI + SBS)
- [ ] 10.2 Test with laser-home example (4 insurers)
- [ ] 10.3 Verify RAG schema fix: check logs for "column chunks.insurer_name does not exist"
- [ ] 10.4 Verify deductible badges render correctly in all views
- [ ] 10.5 Verify uncategorized matrix shows all insurers
- [ ] 10.6 Verify audit works without indexed clauses
- [ ] 10.7 Test performance: measure analysis time for 2 quotes
- [x] 10.8 Build and compile TypeScript without errors

> **Nota**: Tasks 10.1-10.7 re-scoped a `fix-rag-precision-visualization-audit` (tasks 8.1-8.7)

---

## Archivo de Cambio

**Estado**: ARCHIVADO (parcialmente implementado)

**Commit de implementación**: `183bdfc` - fix: RAG schema, audit, deductible badges, quote-based analysis

**Resumen de entrega**:
- ✅ Fix RAG schema (tasks 1.1-1.3)
- ✅ DeductibleBadge component (tasks 2.1-2.5)
- ✅ quoteBasedAuditor service (tasks 4.1-4.6)
- ✅ Integración básica frontend (tasks 9.1-9.4)
- ✅ Build sin errores (task 10.8)

**Tareas pendientes migradas**:
- Tasks 3.1-3.6 → `fix-rag-precision-visualization-audit` (task 5.1)
- Tasks 5.1-5.6 → `fix-rag-precision-visualization-audit` (task 5.7)
- Tasks 6.1-6.5 → `fix-rag-precision-visualization-audit` (task 4.8)
- Tasks 7.1-7.4 → `fix-rag-precision-visualization-audit` (task 1.11)
- Tasks 8.1-8.3 → `fix-rag-precision-visualization-audit` (task 5.8)
- Tasks 9.5 → `fix-rag-precision-visualization-audit` (task 8.3)
- Tasks 10.1-10.7 → `fix-rag-precision-visualization-audit` (tasks 8.1-8.7)

**Motivo**: Este cambio fue entregado parcialmente como hotfix urgente. Las tareas pendientes fueron re-scopedadas al cambio `fix-rag-precision-visualization-audit` como evolución natural de este trabajo.
