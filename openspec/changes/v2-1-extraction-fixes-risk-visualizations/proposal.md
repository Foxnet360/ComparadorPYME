## Why

The V2 multimodal extraction pipeline was deployed to production but exhibits critical issues: deducibles are extracted as "NO ESPECIFICADO" for all insurers (MAPFRE, CHUBB, BBVA, AXA), the "Coberturas No Categorizadas" view only shows MAPFRE data while other insurers appear empty, RAG queries cause massive timeouts (6.2min for 4 quotes vs <5min target), and the audit section lacks visual risk indicators. These issues significantly degrade the user experience and analysis quality, requiring immediate fixes.

## What Changes

- **Fix deductible extraction**: Modify Gemini schema V2 to force deductible extraction across all pages, improve prompts for all format families, and implement intelligent fallback ("No aplica" vs "NO ESPECIFICADO")
- **Preserve uncategorized coverages**: Modify coverage normalizer to preserve and group non-canonical coverages by type ("Asistencias", "Servicios", "Amparos Adicionales") instead of silently discarding them
- **Add risk visualizations**: Create heatmap (coverage × insurer risk levels), radar chart (insurer comparison), and deductible gauges (traffic light indicators)
- **Optimize RAG queries**: Implement insurer-aware RAG that only queries indexed insurers, batch coverage queries, and extract clauses from quote PDFs themselves
- **Automate clause enrichment**: Make audit enrichment automatic when clausulados exist, remove manual button requirement
- **Remove broken RAG references button**: Eliminate non-functional toggle from comparison report
- **Parallelize extraction**: Process multiple quotes simultaneously instead of sequentially
- **Improve performance target**: Reduce analysis time from 6.2min to <3min for 4 quotes

## Capabilities

### New Capabilities
- `risk-visualizations`: Interactive heatmap, radar chart, and deductible gauge components for audit section
- `deductible-extraction-v2`: Enhanced deductible extraction with multi-page awareness and intelligent fallback
- `uncategorized-coverage-grouping-v2`: Preserve and categorize non-canonical coverages by business type

### Modified Capabilities
- `multimodal-pdf-extraction`: Fix schema and prompts to extract deductibles from all pages, not just coverage table
- `coverage-post-normalization`: Modify to preserve uncategorized coverages and assign category IDs using semantic matching
- `rag-retrieval`: Add insurer-aware filtering, batch queries, and clause extraction from source PDFs
- `rag-audit-enrichment`: Make enrichment automatic on audit tab load instead of manual button click
- `unified-coverage-matrix`: Display grouped uncategorized coverages and remove broken RAG references toggle

## Impact

**Backend services affected:** `gemini.ts` (schema), `promptBuilder.ts` (prompts), `coverageNormalizer.ts` (preservation logic), `analysisController.ts` (parallelization, RAG optimization), `quoteValidator.ts` (deductible regex), `crossReferenceEngine.ts` (batch RAG), `ragRetrievalService.ts` (insurer filtering)

**Frontend components affected:** `AuditSection.tsx` (auto-enrichment), `ComparisonReport.tsx` (remove RAG toggle), `UnifiedCoverageMatrix.tsx` (show grouped coverages), new `RiskHeatmap.tsx`, `InsurerRadar.tsx`, `DeductibleGauge.tsx`

**Performance:** Target reduction from 374s to <180s for 4-quote analysis through parallel extraction and batch RAG

**Breaking changes:** None - all changes are backward compatible additions and fixes
