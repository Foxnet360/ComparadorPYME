# Migration Guide: Legacy to Unified Comparison Engine

## Overview

This guide helps migrate from the Legacy Comparison Engine to the Unified Comparison Engine. The unified engine provides:

- **Single LLM call**: Processes all quotes in one call vs. multiple individual calls
- **Better semantic understanding**: Understands equivalent coverage names automatically
- **Faster processing**: Target <60s for 4 quotes vs. ~270s legacy
- **Simpler architecture**: No need for separate extraction, normalization, and comparison steps

## Migration Checklist

### Pre-Migration

- [ ] Review current feature flag status
- [ ] Backup current configuration
- [ ] Notify team of migration
- [ ] Prepare rollback plan

### During Migration

- [ ] Enable unified engine for testing (10%)
- [ ] Monitor fallback rates
- [ ] Validate output quality
- [ ] Compare results with legacy

### Post-Migration

- [ ] Increase rollout to 50%
- [ ] Monitor for 1 week
- [ ] Increase to 100%
- [ ] Schedule legacy deprecation

---

## Step-by-Step Migration

### Step 1: Verify Prerequisites

```bash
# Check environment variables
echo $USE_UNIFIED_ENGINE        # Should be set (even if false)
echo $GEMINI_API_KEY              # Must be valid
echo $GEMINI_MODEL                # Should be "gemini-3.5-flash"

# Verify database schema
# The migration adds new columns to analysis_history table
# See: server/migrations/add_unified_comparison_fields.sql
```

### Step 2: Enable Feature Flag (Testing)

```bash
# Option A: Environment variable
export USE_UNIFIED_ENGINE=true

# Option B: Railway variables
railway variables --environment production \
  USE_UNIFIED_ENGINE=true \
  USE_UNIFIED_ENGINE_ROLLOUT=10  # 10% of users

# Option C: Runtime toggle
GET /api/monitoring/alerts/config
# Modify featureFlags config
```

### Step 3: Monitor Initial Rollout

```bash
# Check unified engine metrics
GET /api/monitoring/unified-engine

# Expected results:
# - Success rate > 95%
# - Fallback rate < 5%
# - Avg processing time < 60s

# Check active alerts
GET /api/monitoring/alerts

# Should see no critical alerts
```

### Step 4: Validate Output Quality

Compare unified vs legacy results:

```bash
# Run both engines on same quotes
POST /api/analyze (legacy)
POST /api/comparison/unified

# Compare:
# - Coverage count
# - Premium values
# - Confidence scores
# - Processing time
```

### Step 5: Gradual Rollout

```bash
# Week 1: 10% of users
export USE_UNIFIED_ENGINE_ROLLOUT=10

# Week 2: 50% of users (if metrics positive)
export USE_UNIFIED_ENGINE_ROLLOUT=50

# Week 3: 100% of users (if stable)
export USE_UNIFIED_ENGINE_ROLLOUT=100
```

### Step 6: Monitor Continuously

```bash
# Daily checks
GET /api/monitoring/dashboard

# Key metrics to watch:
# - fallback_rate < 5%
# - avg_processing_time < 60000ms
# - error_rate < 10%
# - user_feedback.rating > 4.0
```

---

## Feature Flag Configuration

### Environment Variables

```bash
# Enable/disable unified engine
USE_UNIFIED_ENGINE=true

# Rollout percentage (0-100)
USE_UNIFIED_ENGINE_ROLLOUT=10

# Specific users always enabled (comma-separated)
USE_UNIFIED_ENGINE_USERS="admin@example.com,tester@example.com"
```

### Runtime Configuration

```typescript
// Update feature flag at runtime
featureFlags.updateFlag('useUnifiedComparisonEngine', true);

// Update rollout percentage
unifiedComparisonFlag.updateRolloutPercentage(50);

// Check current status
const isEnabled = featureFlags.isEnabled('useUnifiedComparisonEngine');
const rolloutConfig = unifiedComparisonFlag.getRolloutConfig();
```

### Rollback

```bash
# Quick rollback
export USE_UNIFIED_ENGINE=false

# Or via API
PUT /api/monitoring/alerts/config
Body: { "fallbackRateThreshold": 0 }  # Will trigger immediate fallback
```

---

## Architecture Comparison

### Legacy Engine (Pipeline)

```
PDF 1 → Extract → Normalize →
PDF 2 → Extract → Normalize →
PDF 3 → Extract → Normalize → Compare → Score → Narrate
PDF 4 → Extract → Normalize →
```

**Characteristics:**
- 4+ LLM calls (one per quote)
- Separate extraction step
- Normalization with embeddings
- Programmatic comparison
- ~270s for 4 quotes

### Unified Engine

```
PDF 1, PDF 2, PDF 3, PDF 4 → Single LLM Call → Structured JSON
```

**Characteristics:**
- 1 LLM call (all quotes together)
- Multimodal processing
- No separate normalization
- LLM understands equivalences
- Target <60s for 4 quotes

---

## Data Format Changes

### Legacy Output

```typescript
interface LegacyResult {
  quotes: ParsedQuote[];      // Individual extractions
  scores: ScoringResult[];    // Calculated scores
  narratives: NarrativeResult[]; // Generated narratives
  crossRefs: CrossReferenceResult[]; // RAG references
}
```

### Unified Output

```typescript
interface UnifiedResult {
  metadata: ComparisonMetadata;
  client: ClientInfo;
  insurers: Insurer[];
  coverageMatrix: CoverageSection[];
  financials: FinancialBreakdown;
  analysis: AnalysisResults;
}
```

### Migration Notes

1. **Quotes array** → `insurers` + `coverageMatrix`
2. **Scores** → `analysis.bestValue` + confidence scores
3. **Narratives** → `analysis.warnings` + `analysis.significantDifferences`
4. **Cross-references** → Built into coverage matrix with `pageNumber` and `rawText`

---

## UI Component Compatibility

### No Changes Required

The following components work without modification:

- `matrixTransformer.ts` ✅
- `excelGenerator.ts` ✅
- `UnifiedCoverageMatrix.tsx` ✅

### Adapter Usage

```typescript
// Unified engine result is automatically adapted
const matrixRows = await comparisonEngineAdapter.generateComparison(pdfPaths);

// Returns MatrixRow[] compatible with existing UI
```

### Feature Flag Checks

```typescript
// Frontend can check if unified is being used
const isUnified = featureFlags.isEnabled('useUnifiedComparisonEngine');

// Show unified-specific UI if needed
{isUnified && <UnifiedEngineBadge />}
```

---

## API Changes

### Legacy Endpoint

```
POST /api/analyze
Body: multipart/form-data (quotes, clauses)
Response: ComparisonReport
```

### New Endpoints

```
POST /api/comparison/unified
Body: multipart/form-data (quotes)
Response: MatrixRow[]

POST /api/comparison/:id/deep-mode
Body: multipart/form-data (clauses)
Response: DeepModeResult
```

### Backward Compatibility

```typescript
// The existing /api/analyze endpoint now checks feature flag
// If unified is enabled, it uses unified engine
// Otherwise, uses legacy engine

// No API changes required for existing clients
```

---

## Database Schema Changes

### New Columns (analysis_history)

```sql
ALTER TABLE analysis_history 
ADD COLUMN engine_type TEXT DEFAULT 'legacy',
ADD COLUMN processing_time_ms INTEGER,
ADD COLUMN confidence_score INTEGER,
ADD COLUMN unified_result JSONB DEFAULT NULL,
ADD COLUMN fallback_reason TEXT;
```

### Migration Script

See: `server/migrations/add_unified_comparison_fields.sql`

---

## Testing Strategy

### Unit Tests

```typescript
// Test unified engine
describe('Unified Engine', () => {
  it('should process 4 quotes', async () => {
    const result = await unifiedComparisonEngine.compare(pdfPaths);
    expect(result.insurers).toHaveLength(4);
  });
});
```

### Integration Tests

```typescript
// Compare unified vs legacy
describe('Migration Validation', () => {
  it('should match legacy results', async () => {
    const legacy = await legacyEngine.compare(pdfPaths);
    const unified = await unifiedEngine.compare(pdfPaths);
    
    expect(unified.insurers.length).toBe(legacy.quotes.length);
  });
});
```

### Performance Tests

```typescript
// Verify performance improvement
describe('Performance', () => {
  it('should be faster than legacy', async () => {
    const legacyStart = Date.now();
    await legacyEngine.compare(pdfPaths);
    const legacyTime = Date.now() - legacyStart;
    
    const unifiedStart = Date.now();
    await unifiedEngine.compare(pdfPaths);
    const unifiedTime = Date.now() - unifiedStart;
    
    expect(unifiedTime).toBeLessThan(legacyTime);
  });
});
```

---

## Monitoring During Migration

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Fallback Rate | < 5% | > 5% |
| Avg Processing Time | < 60s | > 120s |
| Error Rate | < 2% | > 10% |
| Confidence Score | > 0.7 | < 0.5 |
| User Satisfaction | > 4.0 | < 3.0 |

### Dashboards

```bash
# Unified engine metrics
GET /api/monitoring/unified-engine

# Engine comparison
GET /api/monitoring/engine-comparison

# Full dashboard
GET /api/monitoring/dashboard
```

### Alerts

```bash
# Active alerts
GET /api/monitoring/alerts

# Acknowledge alert
POST /api/monitoring/alerts/:id/acknowledge
```

---

## Rollback Procedure

### Immediate Rollback

```bash
# Disable unified engine
export USE_UNIFIED_ENGINE=false

# Restart service
railway service restart
```

### Gradual Rollback

```bash
# Reduce rollout percentage
export USE_UNIFIED_ENGINE_ROLLOUT=50

# Monitor for issues
# If stable, continue reduction
export USE_UNIFIED_ENGINE_ROLLOUT=10

# If issues persist, disable completely
export USE_UNIFIED_ENGINE=false
```

### Data Preservation

```sql
-- Query unified results for analysis
SELECT * FROM analysis_history 
WHERE engine_type = 'unified' 
AND created_at > NOW() - INTERVAL '7 days';
```

---

## Common Issues During Migration

### Issue: High Fallback Rate

**Symptoms:**
- Fallback rate > 5%
- Most requests use legacy engine

**Solutions:**
1. Check Gemini API availability
2. Verify PDF file sizes (< 20MB)
3. Review error logs: `GET /api/monitoring/errors`
4. Increase timeout if needed

### Issue: Slower Processing

**Symptoms:**
- Processing time > 120s
- Worse than legacy

**Solutions:**
1. Check file sizes
2. Enable caching
3. Verify Redis is available
4. Reduce concurrent requests

### Issue: Different Results

**Symptoms:**
- Unified results differ from legacy
- Users report discrepancies

**Solutions:**
1. Compare results side-by-side
2. Check confidence scores
3. Validate with deep mode
4. Adjust prompt if needed

---

## Post-Migration

### Deprecation Timeline

```
Month 1-2: Unified engine at 100%, legacy available
Month 3-4: Legacy engine deprecated (feature flag removed)
Month 5-6: Legacy code removed
Month 7+: Unified engine only
```

### Cleanup Tasks

- [ ] Remove legacy code paths
- [ ] Update documentation
- [ ] Remove feature flags
- [ ] Archive legacy tests
- [ ] Update CI/CD pipelines

---

## Support

### Monitoring Endpoints

```bash
# Health check
GET /api/health

# Feature flags
GET /api/monitoring/alerts/config

# Engine metrics
GET /api/monitoring/unified-engine

# Error tracking
GET /api/monitoring/errors
```

### Documentation

- [JSON Schema](./JSON_SCHEMA.md)
- [Prompt Guide](./PROMPT_GUIDE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Feature Flags](./FEATURE_FLAGS.md)

---

## Quick Reference

### Enable Unified Engine

```bash
# Immediate (all users)
export USE_UNIFIED_ENGINE=true

# Gradual (percentage)
export USE_UNIFIED_ENGINE_ROLLOUT=50

# Specific users
export USE_UNIFIED_ENGINE_USERS="admin@example.com"
```

### Check Status

```bash
# Dashboard
GET /api/monitoring/dashboard

# Alerts
GET /api/monitoring/alerts

# Errors
GET /api/monitoring/errors
```

### Rollback

```bash
# Quick
export USE_UNIFIED_ENGINE=false

# Gradual
export USE_UNIFIED_ENGINE_ROLLOUT=0
```

---

**Need help?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or review [Error Tracking](../monitoring/errors).