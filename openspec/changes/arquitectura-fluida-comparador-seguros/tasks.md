## 1. Database Schema & Infrastructure

- [x] 1.1 Create `structured_clauses` table with JSONB column and GIN indexes
- [x] 1.2 Create `coverage_mappings` table for learning engine
- [x] 1.3 Create `deductible_benchmarks` table with market standards
- [x] 1.4 Add RPC functions for hybrid search (vector + full-text)
- [x] 1.5 Add RPC functions for structured clause search
- [x] 1.6 Setup Redis for caching embeddings and coverage mappings
- [x] 1.7 Create migration scripts for existing chunk data

## 2. Structured Clause Extraction

- [x] 2.1 Implement `structuredClauseExtractor.ts` service
- [x] 2.2 Create JSON schema for clause extraction validation
- [x] 2.3 Build prompt template for clause extraction with few-shot examples
- [x] 2.4 Add validation against raw text for extracted data
- [x] 2.5 Implement storage function for structured clauses
- [x] 2.6 Create endpoint `/api/clauses/structured` for extraction
- [ ] 2.7 Test extraction with sample clause PDFs (CHUBB, MAPFRE, BBVA, AXA)

## 3. Semantic Coverage Ontology

- [x] 3.1 Create `coverageOntology.ts` with 3-level hierarchy
- [x] 3.2 Implement probabilistic mapping function
- [x] 3.3 Build composite coverage detection logic
- [x] 3.4 Create semantic similarity calculator for coverage grouping
- [x] 3.5 Implement coverage group naming algorithm
- [x] 3.6 Add tests for probabilistic mappings
- [x] 3.7 Create seed data for initial ontology structure

## 4. Variable Comparison Engine

- [x] 4.1 Implement `variableComparator.ts` service
- [x] 4.2 Create comparison matrix generator
- [x] 4.3 Build variable extraction from quote data (value, deductible, sublimit, exclusions)
- [x] 4.4 Implement gap detection (exclusive coverages)
- [x] 4.5 Add user-defined weight support for comparison
- [x] 4.6 Create endpoint `/api/quotes/compare-variables`
- [ ] 4.7 Build frontend component for variable comparison matrix

## 5. Deductible Semantic Parser

- [x] 5.1 Implement `deductibleParser.ts` with compound structure support
- [x] 5.2 Create regex patterns for simple cases (fallback)
- [x] 5.3 Build LLM prompt for complex deductible parsing
- [x] 5.4 Add validation (min < max, percentage 0-100)
- [x] 5.5 Implement `deductibleBenchmarks.ts` with market standards
- [x] 5.6 Create expected cost calculator
- [ ] 5.7 Add tests for compound deductible parsing
- [x] 5.8 Integrate with existing `deductibleAnalyzer.ts`

## 6. Triple Source Chat

- [x] 6.1 Refactor `chatService.ts` to implement triple source priority
- [x] 6.2 Build quote data search function (primary source)
- [x] 6.3 Add structured clause search (secondary source)
- [x] 6.4 Implement source attribution in responses
- [x] 6.5 Add fallback logic (never respond "I don't have information")
- [x] 6.6 Create system prompt template for triple source
- [x] 6.7 Add tests for chat with missing RAG data
- [ ] 6.8 Update frontend chat UI to show source labels

## 7. Query Expansion & Hybrid Search

- [x] 7.1 Implement `queryExpander.ts` using thesaurus
- [x] 7.2 Add synonym and related term expansion
- [x] 7.3 Build multi-query search executor
- [ ] 7.4 Implement parent-child retrieval logic
- [ ] 7.5 Add re-ranking with cross-encoder (local or API)
- [x] 7.6 Update `ragRetrievalService.ts` with hybrid search v2
- [x] 7.7 Add performance metrics logging
- [ ] 7.8 Test search quality improvements

## 8. Learning Engine

- [x] 8.1 Implement `learningEngine.ts` service
- [x] 8.2 Create user correction capture interface
- [x] 8.3 Build thesaurus update function from corrections
- [x] 8.4 Add embedding retraining trigger (batch process)
- [x] 8.5 Implement correction effectiveness tracking
- [x] 8.6 Create monthly accuracy report generator
- [ ] 8.7 Add correction UI to analysis results page

## 9. Integration & Refactoring

- [ ] 9.1 Replace `coverageNormalizer.ts` with semantic ontology
- [x] 9.2 Update `semanticMatcher.ts` for probabilistic mappings
- [x] 9.3 Refactor `crossReferenceEngine.ts` for variable comparison
- [x] 9.4 Update `quoteScorer.ts` to use new comparison metrics
- [x] 9.5 Add feature flags for gradual activation
- [x] 9.6 Create backward compatibility layer
- [x] 9.7 Update TypeScript types in `types.ts`

## 10. Testing & Quality Assurance

- [x] 10.1 Unit tests for `structuredClauseExtractor.ts`
- [ ] 10.2 Unit tests for `deductibleParser.ts`
- [ ] 10.3 Integration tests for variable comparison
- [ ] 10.4 End-to-end tests for complete analysis flow
- [ ] 10.5 Performance tests (target: <120s per analysis)
- [ ] 10.6 Accuracy tests (target: >85% correct extractions)
- [ ] 10.7 Load tests for concurrent analyses

## 11. Documentation & Deployment

- [x] 11.1 Update API documentation
- [x] 11.2 Create user guide for new features
- [x] 11.3 Write migration guide for existing data
- [ ] 11.4 Setup monitoring dashboard
- [x] 11.5 Create rollback procedures
- [ ] 11.6 Deploy to staging environment
- [ ] 11.7 Run smoke tests in staging
- [ ] 11.8 Deploy to production with feature flags

## 12. Post-Deployment

- [ ] 12.1 Monitor accuracy metrics for 1 week
- [ ] 12.2 Collect user feedback on new ontology
- [ ] 12.3 Measure chat response quality improvement
- [ ] 12.4 Analyze deductible parsing accuracy
- [ ] 12.5 Tune benchmarks based on real data
- [ ] 12.6 Optimize performance bottlenecks
- [ ] 12.7 Plan Phase 2 enhancements based on feedback
