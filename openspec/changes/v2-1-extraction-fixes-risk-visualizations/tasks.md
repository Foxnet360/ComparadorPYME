## 1. Fix Deductible Extraction Backend

- [x] 1.1 Modify `server/src/services/gemini.ts`: Change deductible field from `nullable: true` to mandatory with explicit description
- [x] 1.2 Update `server/src/services/promptBuilder.ts`: Add multi-page deductible search instruction to ALL 6 format family prompts
- [x] 1.3 Update `server/src/services/promptBuilder.ts`: Add HDI-specific instruction "deductibles on page 2"
- [x] 1.4 Update `server/src/services/promptBuilder.ts`: Add CHUBB-specific instruction "search all pages including conditions"
- [x] 1.5 Update `server/src/services/promptBuilder.ts`: Add MAPFRE-specific instruction "each section has its own deductible"
- [x] 1.6 Update `server/src/services/promptBuilder.ts`: Add AXA-specific instruction "search in descriptive text and final clauses"
- [x] 1.7 Update `server/src/services/promptBuilder.ts`: Add SBS-specific instruction "check premium table for deductible column"
- [x] 1.8 Update `server/src/services/promptBuilder.ts`: Add BOLIVAR-specific instruction "search in special conditions at end"
- [x] 1.9 Modify `server/src/controllers/analysisController.ts`: Implement intelligent fallback - "No aplica" for service coverages, "NO ESPECIFICADO" only for material coverages
- [x] 1.10 Modify `server/src/controllers/analysisController.ts`: Check generalDeductibles before falling back to "NO ESPECIFICADO"
- [x] 1.11 Update `server/src/services/quoteValidator.ts`: Add regex patterns for Colombian deductible formats ("10% PERD Min 1 SMMLV", "Sin deducible", "No aplica", etc.)
- [x] 1.12 Create `server/src/services/deductibleResolver.ts`: New service to resolve deductibles using coverage type + general deductibles

## 2. Preserve Uncategorized Coverages

- [ ] 2.1 Modify `server/src/services/coverageNormalizer.ts`: Add `uncategorizedCoverages` array to return type
- [ ] 2.2 Modify `server/src/services/coverageNormalizer.ts`: Preserve non-canonical coverages instead of discarding
- [ ] 2.3 Modify `server/src/services/coverageNormalizer.ts`: Filter out empty coverages (insuredAmount=0 AND premium=0)
- [ ] 2.4 Create `server/src/services/semanticGrouper.ts`: New service to group uncategorized coverages by semantic similarity
- [ ] 2.5 Implement grouping logic in `semanticGrouper.ts`: "Asistencias", "Servicios", "Amparos Adicionales", "Otros"
- [ ] 2.6 Modify `server/src/services/coverageNormalizer.ts`: Assign categoryId, matchConfidence, matchMethod to ALL coverages (canonical + uncategorized)
- [ ] 2.7 Modify `server/src/controllers/analysisController.ts`: Include `uncategorizedCoverages` in response JSON

## 3. Optimize RAG Performance

- [ ] 3.1 Modify `server/src/services/ragRetrievalService.ts`: Add `checkInsurerHasClauses()` pre-flight function
- [ ] 3.2 Modify `server/src/controllers/analysisController.ts`: Check clause availability before RAG queries
- [ ] 3.3 Modify `server/src/controllers/analysisController.ts`: Skip RAG for insurers with no indexed clauses
- [ ] 3.4 Modify `server/src/controllers/analysisController.ts`: Implement batch RAG - one query per coverage, distribute to all insurers
- [ ] 3.5 Create `server/src/services/pdfClauseExtractor.ts`: Extract clauses from quote PDFs (pages beyond coverage table)
- [ ] 3.6 Modify `server/src/services/crossReferenceEngine.ts`: Merge PDF-extracted clauses with indexed clauses
- [ ] 3.7 Modify `server/src/controllers/analysisController.ts`: Implement parallel quote processing with Promise.all()
- [ ] 3.8 Add memory monitoring to parallel processing: limit concurrency to 2 if memory >80%

## 4. Automate Clause Enrichment

- [ ] 4.1 Modify `components/AuditSection.tsx`: Auto-call enrich() on component mount when clausulados available
- [ ] 4.2 Modify `components/AuditSection.tsx`: Show loading indicator during auto-enrichment
- [ ] 4.3 Modify `components/AuditSection.tsx`: Show info message when no clausulados (with link to upload)
- [ ] 4.4 Modify `components/AuditSection.tsx`: Change button to "Actualizar con Clausulados" (re-enrichment)
- [ ] 4.5 Modify `server/src/routes/audit.ts`: Make enrichment endpoint async with progress tracking
- [ ] 4.6 Add progress indicator to frontend: "Enriqueciendo X de Y alertas"

## 5. Remove Broken UI Elements

- [ ] 5.1 Modify `components/ComparisonReport.tsx`: Remove "Referencias RAG" toggle button
- [ ] 5.2 Modify `components/UnifiedCoverageMatrix.tsx`: Remove `showRagReferences` prop
- [ ] 5.3 Clean up any references to `showRagReferences` in parent components

## 6. Create Risk Visualization Components

- [ ] 6.1 Create `components/RiskHeatmap.tsx`: Heatmap component with 14 rows × N columns
- [ ] 6.2 Implement heatmap color logic: green (low), yellow (medium), red (high), gray (not included)
- [ ] 6.3 Add heatmap tooltips: value, deductible, risk score, reason
- [ ] 6.4 Add horizontal scroll for >4 insurers
- [ ] 6.5 Create `components/InsurerRadar.tsx`: Radar chart with 5 axes (Price, Coverage, Deductibles, Clauses, Risk)
- [ ] 6.6 Implement radar modal: opens on insurer name click
- [ ] 6.7 Implement multi-insurer radar: overlay lines for 2+ selected insurers
- [ ] 6.8 Create `components/DeductibleGauge.tsx`: Circular gauge component
- [ ] 6.9 Implement gauge colors: green (no deductible), yellow (1-10%), red (>10% or unspecified)
- [ ] 6.10 Add gauge tooltips: exact deductible, market comparison, recommendation

## 7. Integrate Visualizations into Audit Section

- [ ] 7.1 Modify `components/AuditSection.tsx`: Add "Heatmap" tab
- [ ] 7.2 Modify `components/AuditSection.tsx`: Add "Radar" button that opens modal
- [ ] 7.3 Modify `components/UnifiedCoverageMatrix.tsx`: Replace text deductible with DeductibleGauge component
- [ ] 7.4 Add responsive behavior: heatmap → vertical list on mobile
- [ ] 7.5 Add responsive behavior: radar → full screen on mobile

## 8. Update Coverage Matrix for Uncategorized

- [ ] 8.1 Modify `components/UnifiedCoverageMatrix.tsx`: Add "Coberturas Adicionales" section
- [ ] 8.2 Implement grouped display: accordion by semantic group ("Asistencias", "Servicios", etc.)
- [ ] 8.3 Show comparison across insurers for each additional coverage
- [ ] 8.4 Highlight exclusive coverages (only offered by one insurer)
- [ ] 8.5 Hide section when no uncategorized coverages exist

## 9. Testing and Validation

- [ ] 9.1 Test deductible extraction with laser-home examples (MAPFRE, CHUBB, BBVA, AXA)
- [ ] 9.2 Verify all 6 format families extract deductibles correctly
- [ ] 9.3 Test uncategorized coverage preservation and grouping
- [ ] 9.4 Test RAG timeout reduction: verify <30s for batch queries
- [ ] 9.5 Test parallel extraction: verify <3min for 4 quotes
- [ ] 9.6 Test auto-enrichment: verify it triggers on audit tab load
- [ ] 9.7 Test visualizations: verify heatmap, radar, gauge render correctly
- [ ] 9.8 Test responsive design: mobile and tablet views

## 10. Feature Flag and Deploy

- [ ] 10.1 Add feature flag `ENABLE_V2_1_FIXES` to `config/features.ts`
- [ ] 10.2 Wrap all changes behind feature flag (default: false)
- [ ] 10.3 Test with feature flag disabled: verify backward compatibility
- [ ] 10.4 Test with feature flag enabled: verify all improvements work
- [ ] 10.5 Deploy to staging with `ENABLE_V2_1_FIXES=true`
- [ ] 10.6 Validate with laser-home examples in staging
- [ ] 10.7 Monitor logs for 24h
- [ ] 10.8 Enable gradual rollout: 25% → 50% → 100%
- [ ] 10.9 Update documentation (README, CHANGELOG)
