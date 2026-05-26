## 1. Environment Configuration

- [x] 1.1 Create `.env.example` file in project root documenting all required and optional variables
- [x] 1.2 Update `server/src/index.ts` to load `.env` from project root instead of server directory
- [x] 1.3 Add fallback logic: if root `.env` not found, try `server/.env` with deprecation warning
- [x] 1.4 Enhance `server/src/config/env.ts` validation to provide clear error messages for each missing variable
- [x] 1.5 Add startup logging that shows loaded configuration (without secrets)
- [x] 1.6 Test environment loading in both development and production modes

## 2. Health Check Endpoint

- [x] 2.1 Create `server/src/services/healthCheckService.ts` with dependency checks for Gemini, Supabase, and Redis
- [x] 2.2 Implement Gemini health check using `models.list()` or lightweight ping
- [x] 2.3 Implement Supabase health check using `SELECT 1` query
- [x] 2.4 Implement Redis health check using `PING` command (if configured)
- [x] 2.5 Extend `GET /health` endpoint to return structured health status with service latencies
- [x] 2.6 Add 30-second caching for health check results to avoid excessive API calls
- [x] 2.7 Test health endpoint scenarios: all healthy, Gemini down, Supabase down, Redis not configured

## 3. Error Handling - Gemini Error Classes

- [x] 3.1 Create `server/src/errors/geminiErrors.ts` with GeminiError subclasses:
  - `GeminiRateLimitError` (429)
  - `GeminiServiceUnavailableError` (503)
  - `GeminiTimeoutError` (504)
  - `GeminiInvalidResponseError` (502)
  - `GeminiUnknownError` (500)
- [x] 3.2 Update `server/src/errors/index.ts` to export new error classes
- [x] 3.3 Modify `server/src/services/gemini.ts` to throw categorized errors instead of generic ones
- [x] 3.4 Update `server/src/middleware/errorHandler.ts` to handle GeminiError subclasses with appropriate status codes and messages
- [x] 3.5 Add user-friendly Spanish error messages for each Gemini error category
- [x] 3.6 Add `requestId` to all error responses and propagate it through logs

## 4. Graceful Degradation in Pipeline

- [x] 4.1 Enhance `server/src/controllers/analysisController.ts` to catch individual quote failures and continue processing remaining quotes
- [x] 4.2 Update error placeholder object to include `isFailed: true`, `errorCategory`, and `errorCode` fields
- [x] 4.3 Ensure cleanup (delete temp files) happens even when individual quotes fail
- [x] 4.4 Add logging for failed quotes with filename, error category, and request ID
- [x] 4.5 Update `generateComparison` function to handle quotes with `isFailed: true` appropriately in scoring
- [x] 4.6 Test with multiple quotes where one fails: verify others process successfully

## 5. Feature Flags

- [x] 5.1 Modify `server/src/config/featureFlags.ts` to check Redis availability before enabling `learningEngine`
- [x] 5.2 Add startup logging that shows all feature flags and their values
- [x] 5.3 Add logging for any flags that were auto-disabled due to missing dependencies
- [x] 5.4 Verify `GET /api/features` endpoint returns current feature configuration
- [x] 5.5 Test feature flag behavior: with Redis configured, without Redis configured

## 6. CORS Configuration

- [x] 6.1 Update `server/src/index.ts` to read `CORS_ORIGINS` from environment variable
- [x] 6.2 Add JSON parsing for `CORS_ORIGINS` with fallback to localhost defaults
- [x] 6.3 Add validation that `CORS_ORIGINS` is valid JSON array
- [x] 6.4 Add startup logging showing allowed CORS origins
- [x] 6.5 Test CORS with different origin configurations

## 7. Testing and Validation

- [x] 7.1 Create integration test for health endpoint with mocked services
- [x] 7.2 Create unit tests for Gemini error classes
- [x] 7.3 Create test for graceful degradation: force one quote to fail, verify others succeed
- [x] 7.4 Create test for environment validation: verify server exits when required vars missing
- [x] 7.5 Test error responses include requestId and user-friendly messages
- [x] 7.6 Run full end-to-end test: upload 3 quotes, verify all process correctly

## 8. Documentation and Deployment

- [x] 8.1 Update `README.md` with new environment variable requirements (`CORS_ORIGINS`)
- [x] 8.2 Update `README.md` with health endpoint documentation
- [x] 8.3 Update `README.md` with error response format documentation
- [x] 8.4 Verify `Dockerfile` copies `.env` correctly from project root
- [x] 8.5 Update deployment documentation with new feature flag behavior
- [x] 8.6 Create rollback plan document
