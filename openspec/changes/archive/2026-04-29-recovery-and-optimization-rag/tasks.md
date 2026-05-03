## 1. Revert and Cleanup

- [x] 1.1 Revert `gemini.ts` to remove responseSchema and responseMimeType forcing
- [x] 1.2 Remove broken services: `multiPhaseAnalyzer.ts`, `quoteExtractor.ts`, `quoteScorer.ts`, `quoteNarrative.ts`, `contextOptimizer.ts`
- [x] 1.3 Clean up unused imports and constants in `analysisController.ts`
- [x] 1.4 Verify `npm run build` passes after cleanup

## 2. Text-Based Quote Extraction

- [x] 2.1 Create free-text extraction prompt for Gemini (no schema, no mimeType)
- [x] 2.2 Implement `quoteParser.ts` with regex patterns for field extraction
- [x] 2.3 Add parsing logic for coverage lists with values and deductibles
- [x] 2.4 Integrate thesaurus normalization into parser
- [x] 2.5 Add parser confidence scoring
- [ ] 2.6 Test parser with sample Gemini outputs

## 3. Database Schema for RAG

- [x] 3.1 Create `clause_chunks` table with pgvector extension
- [x] 3.2 Add HNSW index on embedding column
- [x] 3.3 Add GIN index on coverage_tags array
- [x] 3.4 Create `match_clauses` RPC function for hybrid search
- [x] 3.5 Run migration in Supabase dashboard (user action required)
- [x] 3.6 Verify table creation and index performance (user action required)

## 4. Async Clause Indexing

- [x] 4.1 Create `clauseIndexer.ts` service for background processing
- [x] 4.2 Implement chunking strategy (chapter-level with overlap)
- [x] 4.3 Add coverage detection using thesaurus for chunk tagging
- [x] 4.4 Integrate embedding generation (batch size 50)
- [x] 4.5 Create `POST /api/clauses/index` endpoint with job tracking
- [x] 4.6 Create `GET /api/clauses/status/:jobId` endpoint
- [x] 4.7 Test end-to-end clause indexing flow

## 5. RAG Retrieval System

- [x] 5.1 Implement vector similarity search function
- [x] 5.2 Implement full-text search function
- [x] 5.3 Create hybrid search combining both methods
- [x] 5.4 Add insurer filtering to retrieval
- [x] 5.5 Add coverage_tags filtering to retrieval
- [x] 5.6 Implement cross-insurer fallback when no clauses found
- [ ] 5.7 Test retrieval with sample queries

## 6. Cross-Reference Engine

- [x] 6.1 Create `crossReferenceEngine.ts` for coverage-clause matching
- [x] 6.2 Implement deducible comparison logic
- [x] 6.3 Implement exclusion detection from retrieved clauses
- [x] 6.4 Generate discrepancy alerts (CRITICAL/WARNING/INFO)
- [ ] 6.5 Test cross-referencing with sample quote + clause data

## 7. Rule-Based Scoring

- [x] 7.1 Implement coverage completeness scoring
- [x] 7.2 Implement deductible favorability scoring
- [x] 7.3 Implement price ratio scoring
- [x] 7.4 Implement exclusion risk scoring
- [x] 7.5 Implement sub-limit impact scoring
- [x] 7.6 Implement warranty ease scoring
- [x] 7.7 Create configurable weights system
- [x] 7.8 Add score validation (0-100 integer range)
- [x] 7.9 Test scoring with sample quotes

## 8. Narrative Generation

- [x] 8.1 Create narrative generation prompt for Gemini
- [x] 8.2 Integrate narrative generation into analysis flow
- [x] 8.3 Limit narrative output to 1500 characters
- [ ] 8.4 Test narrative generation with sample analyses

## 9. Integration and API

- [x] 9.1 Wire up `analysisController.ts` with new flow:
  - Extract quotes using text-based method
  - Normalize with thesaurus
  - Retrieve clauses via RAG
  - Cross-reference coverage data
  - Calculate scores
  - Generate narrative
- [x] 9.2 Preserve existing `/api/analyze` endpoint contract
- [x] 9.3 Add error handling for each phase
- [x] 9.4 Add progress logging for debugging

## 10. Testing and Validation

- [ ] 10.1 Test with 3 quotes from different insurers
- [ ] 10.2 Verify no JSON truncation errors
- [ ] 10.3 Verify total analysis time under 10 seconds
- [ ] 10.4 Test RAG retrieval accuracy
- [ ] 10.5 Validate scoring consistency across repeated runs
- [ ] 10.6 Test clause indexing with 50+ page documents
- [x] 10.7 Run full backend test suite
- [ ] 10.8 Verify frontend compatibility with new output format