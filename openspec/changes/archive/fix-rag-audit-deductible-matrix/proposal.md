## Why

Production logs reveal that the audit section is completely non-functional because the RAG retrieval service queries the wrong database table (`chunks` instead of `clause_chunks`), causing the "No hay clausulados indexados" message to always appear. Additionally, the DeductibleGauge component (60px circular SVG) creates visual chaos in the coverage matrix, overlapping with text and providing no clear value. The uncategorized coverage matrix view only shows data for the first insurer (SBS). These critical UI and data issues make the tool unreliable for insurance brokers comparing PYME quotes.

## What Changes

- **Fix RAG schema error**: Change `ragRetrievalService.checkInsurerHasClauses()` to query `clause_chunks` table (or documents with proper JOIN) instead of `chunks` which lacks `insurer_name` column
- **Replace DeductibleGauge with DeductibleBadge**: Compact inline badge (8px dot) with color coding instead of 60px circular gauge that overlaps text
- **Fix uncategorized coverage matrix**: Implement true N×M matrix showing all insurers' data, not just the first column
- **Add quote-based audit analysis**: New service that analyzes deductibles, missing coverages, and special conditions directly from quote data without RAG dependency
- **Add structured deductible matrix tab**: Comprehensive view showing coverage × insurer matrix with sum insured, sublimits, and deductibles side-by-side
- **Extract special conditions from quotes**: Parse raw text for patterns like "Condición especial:", "Excluye:", "Sujeto a:"
- **Optimize semantic matching**: Reduce LLM calls by using embeddings batch and fuzzy matching first

## Capabilities

### New Capabilities
- `quote-based-audit`: Audit analysis using only quote extraction data, independent of RAG clause availability
- `deductible-matrix`: Structured deductible comparison matrix across insurers with risk indicators
- `special-conditions-extraction`: Extract special conditions and exclusions from quote PDF raw text

### Modified Capabilities
- `rag-retrieval`: Fix table schema query to use correct table for insurer clause lookup
- `coverage-matrix`: Fix uncategorized view to show all insurers and simplify deductible display

## Impact

- **Frontend**: AuditSection (add quote-based analysis), UnifiedCoverageMatrix (fix matrix + badges), new DeductibleBadge component, new DeductibleMatrix component
- **Backend**: ragRetrievalService (fix schema), auditEnrichmentService (fix check), new quoteBasedAuditor service
- **Performance**: Reduce analysis time from 170s to <60s by optimizing semantic matching
- **User Experience**: Audit section becomes functional without requiring indexed clauses; deductible visualization becomes readable
