# Tasks: unified-multimodal-comparison-engine

## 1. Setup and Infrastructure

- [x] 1.1 Create directory structure for new services: `server/src/services/unifiedComparison/`
- [x] 1.2 Define TypeScript types: `server/src/types/unifiedComparison.ts`
- [x] 1.3 Create JSON Schema for `UnifiedComparisonResult` validation
- [x] 1.4 Add feature flag configuration: `USE_UNIFIED_ENGINE` to environment and config
- [x] 1.5 Create feature flag service wrapper for runtime checks

## 2. Core Unified Comparison Engine

- [x] 2.1 Implement `unifiedComparisonEngine.ts` with main `compare()` method
- [x] 2.2 Implement `comparisonPromptBuilder.ts` with prompt template based on reference prompt
- [x] 2.3 Configure Gemini 3.5 Flash client with proper settings (no temperature/top_p/top_k)
- [x] 2.4 Implement PDF upload and batch processing for multiple files
- [x] 2.5 Implement structured output parsing with JSON Schema validation
- [x] 2.6 Implement `comparisonResultValidator.ts` with business rules validation
- [x] 2.7 Add confidence scoring algorithm for result quality
- [x] 2.8 Implement retry logic with correction prompt for malformed outputs
- [x] 2.9 Add comprehensive logging for debugging comparison process

## 3. Adapter and Coexistence Layer

- [x] 3.1 Implement `comparisonEngineAdapter.ts` with feature flag routing
- [x] 3.2 Implement `toMatrixRows()` transformation from `UnifiedComparisonResult` to `MatrixRow[]`
- [x] 3.3 Implement automatic fallback to legacy engine on unified engine failure
- [x] 3.4 Add logging for routing decisions and fallback events
- [x] 3.5 Implement gradual rollout support (percentage-based activation)
- [x] 3.6 Add user-specific override capability for testing
- [x] 3.7 Ensure 100% backward compatibility with existing UI components

## 4. Deep Clause Validation (Modo Profundo)

- [x] 4.1 Implement `deepClauseValidator.ts` with `validateWithClauses()` method
- [x] 4.2 Create clause-specific prompt for deductible resolution
- [x] 4.3 Implement clause PDF processing and section extraction
- [x] 4.4 Add ambiguous deductible resolution logic
- [x] 4.5 Implement discrepancy detection between quotes and clauses
- [x] 4.6 Add exclusion detection from clauses not mentioned in quotes
- [x] 4.7 Implement `POST /api/comparison/:id/deep-mode` endpoint
- [x] 4.8 Add validation to prevent deep mode without clause files

## 5. API Endpoints

- [x] 5.1 Create `POST /api/comparison/unified` endpoint
- [x] 5.2 Implement request validation (file count, file types, size limits)
- [x] 5.3 Implement response formatting with proper error handling
- [x] 5.4 Add authentication and authorization checks
- [x] 5.5 Implement `POST /api/comparison/:id/deep-mode` endpoint
- [x] 5.6 Add Server-Sent Events for progress streaming on long comparisons
- [x] 5.7 Create OpenAPI documentation for new endpoints

## 6. Integration with Existing System

- [x] 6.1 Modify quote analysis service to check feature flag before routing
- [x] 6.2 Ensure `matrixTransformer.ts` works with adapter output (no modifications)
- [x] 6.3 Ensure `excelGenerator.ts` works with adapter output (no modifications)
- [x] 6.4 Ensure `UnifiedCoverageMatrix.tsx` works with adapter output (no modifications)
- [x] 6.5 Add unified result storage to database schema
- [x] 6.6 Implement comparison result caching for performance

## 7. Testing

- [x] 7.1 Create unit tests for `comparisonPromptBuilder.ts`
- [x] 7.2 Create unit tests for `comparisonResultValidator.ts`
- [x] 7.3 Create unit tests for adapter transformation logic
- [x] 7.4 Create integration test with laser-home example (4 quotes)
- [x] 7.5 Validate output JSON matches reference Excel structure
- [x] 7.6 Test fallback mechanism by simulating unified engine failure
- [x] 7.7 Test feature flag toggle without server restart
- [x] 7.8 Test deep mode with clause PDFs
- [x] 7.9 Test gradual rollout percentage logic
- [x] 7.10 Performance test: measure time vs legacy engine (target: <60s for 4 quotes)
- [x] 7.11 Test with edge cases: 1 quote, 8+ quotes, quotes with missing data

## 8. Monitoring and Observability

- [x] 8.1 Add metrics: unified engine success rate, fallback rate, average processing time
- [x] 8.2 Create dashboard for comparing unified vs legacy engine performance
- [x] 8.3 Add alerting for high fallback rates (>5%)
- [x] 8.4 Implement structured logging with correlation IDs
- [x] 8.5 Add error tracking for unified engine specific failures

## 9. Documentation

- [x] 9.1 Document JSON Schema for `UnifiedComparisonResult`
- [x] 9.2 Document prompt structure and customization points
- [x] 9.3 Create migration guide from legacy to unified engine
- [x] 9.4 Document feature flag configuration and rollout strategy
- [x] 9.5 Update API documentation with new endpoints
- [x] 9.6 Create troubleshooting guide for common failures

## 10. Deployment and Rollout

- [x] 10.1 Deploy with `USE_UNIFIED_ENGINE=false` (disabled by default)
- [x] 10.2 Enable for internal testing team
  - Added admin endpoints for runtime control:
    - GET /api/monitoring/unified-engine/admin/status
    - POST /api/monitoring/unified-engine/admin/enable
    - POST /api/monitoring/unified-engine/admin/rollout
    - POST /api/monitoring/unified-engine/admin/users
  - Added methods to featureFlagService: addEnabledUser, removeEnabledUser, setEnabledUsers
- [x] 10.3 Enable for 10% of production users
  - Skipped: Enabled 100% directly for testing
- [x] 10.4 Monitor metrics
  - Dashboard: https://comparadorpyme-production.up.railway.app/api/monitoring/dashboard
  - Monitoring continuously (user requested immediate testing, not waiting 1 week)
- [x] 10.5 Increase to 50% if metrics are positive
  - Skipped: Went directly to 100%
- [x] 10.6 Increase to 100% after 2 weeks of stable metrics
  - DONE: Enabled 100% rollout on 2026-05-27
  - Status: enabled=true, percentage=100
- [ ] 10.7 Schedule legacy engine deprecation (future release)
  - To be scheduled after unified engine proves stable
