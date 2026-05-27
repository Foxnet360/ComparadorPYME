# Feature Flag Configuration and Rollout Strategy

## Overview

The Unified Comparison Engine uses a comprehensive feature flag system to enable safe, gradual rollout. This document describes the configuration options and recommended rollout strategy.

## Feature Flag System

### Architecture

The system uses a two-layer feature flag approach:

1. **Global Feature Flag**: Enable/disable the unified engine globally
2. **Rollout Configuration**: Control percentage-based activation

### Global Feature Flag

```typescript
// In server/src/config/featureFlags.ts
interface FeatureFlags {
  useUnifiedComparisonEngine: boolean;  // Master switch
  // ... other flags
}
```

**Configuration:**

```bash
# Environment variable
USE_UNIFIED_ENGINE=true|false

# Or via Railway
railway variables --environment production USE_UNIFIED_ENGINE=true
```

**Runtime Toggle:**

```typescript
import { featureFlags } from './config/featureFlags';

// Check status
const isEnabled = featureFlags.isEnabled('useUnifiedComparisonEngine');

// Toggle
featureFlags.updateFlag('useUnifiedComparisonEngine', true);
```

### Rollout Configuration

```typescript
// In server/src/services/unifiedComparison/featureFlagService.ts
interface RolloutConfig {
  percentage: number;        // 0-100
  enabledUsers?: string[];   // Always-enabled users
}
```

**Configuration:**

```bash
# Environment variables
USE_UNIFIED_ENGINE_ROLLOUT=10           # 10% of users
USE_UNIFIED_ENGINE_USERS="user1,user2"  # Specific users
```

**Runtime Control:**

```typescript
import { unifiedComparisonFlag } from './featureFlagService';

// Update rollout
unifiedComparisonFlag.updateRolloutPercentage(50);

// Check for specific user
const enabled = unifiedComparisonFlag.isEnabled('user-123');

// Get current config
const config = unifiedComparisonFlag.getRolloutConfig();
```

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1-2)

**Goal:** Validate functionality with internal team

**Configuration:**
```bash
USE_UNIFIED_ENGINE=true
USE_UNIFIED_ENGINE_ROLLOUT=0           # No automatic rollout
USE_UNIFIED_ENGINE_USERS="admin1,admin2,tester1"  # Specific users only
```

**Activities:**
- Test with real quotes
- Compare results with legacy
- Measure performance
- Identify edge cases

**Success Criteria:**
- Success rate > 95%
- Fallback rate < 5%
- Processing time < 60s
- No critical bugs

### Phase 2: Canary Release (Week 3-4)

**Goal:** Test with small subset of users

**Configuration:**
```bash
USE_UNIFIED_ENGINE=true
USE_UNIFIED_ENGINE_ROLLOUT=10          # 10% of users
USE_UNIFIED_ENGINE_USERS="admin1,admin2"  # Keep admins
```

**Activities:**
- Monitor fallback rates
- Collect user feedback
- Track error rates
- Measure satisfaction

**Success Criteria:**
- Fallback rate < 5%
- Error rate < 2%
- User satisfaction > 4.0
- No increase in support tickets

### Phase 3: Gradual Rollout (Week 5-8)

**Goal:** Increase coverage while monitoring

**Week 5:**
```bash
USE_UNIFIED_ENGINE_ROLLOUT=25          # 25% of users
```

**Week 6:**
```bash
USE_UNIFIED_ENGINE_ROLLOUT=50          # 50% of users
```

**Week 7:**
```bash
USE_UNIFIED_ENGINE_ROLLOUT=75          # 75% of users
```

**Week 8:**
```bash
USE_UNIFIED_ENGINE_ROLLOUT=100         # 100% of users
```

**Activities:**
- Daily metrics review
- Alert monitoring
- User feedback collection
- Performance optimization

### Phase 4: Full Deployment (Week 9+)

**Goal:** Complete migration

**Configuration:**
```bash
USE_UNIFIED_ENGINE=true
USE_UNIFIED_ENGINE_ROLLOUT=100         # All users
```

**Activities:**
- Legacy code deprecation planning
- Documentation updates
- Team training
- Support procedure updates

---

## Monitoring During Rollout

### Key Metrics

Track these metrics daily during rollout:

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|--------|---------|---------|---------|---------|
| Fallback Rate | < 5% | < 5% | < 3% | < 2% |
| Processing Time | < 120s | < 90s | < 70s | < 60s |
| Error Rate | < 5% | < 3% | < 2% | < 1% |
| Confidence Score | > 0.7 | > 0.75 | > 0.8 | > 0.85 |
| User Satisfaction | N/A | > 3.5 | > 4.0 | > 4.2 |

### Monitoring Commands

```bash
# Check current metrics
GET /api/monitoring/unified-engine

# View engine comparison
GET /api/monitoring/engine-comparison

# Check alerts
GET /api/monitoring/alerts

# Full dashboard
GET /api/monitoring/dashboard
```

### Alert Thresholds

Configure alerts for:

```bash
# High fallback rate
ALERT_FALLBACK_THRESHOLD=5          # 5%

# Slow processing
ALERT_PROCESSING_TIME_THRESHOLD=120000  # 120 seconds

# High error rate
ALERT_ERROR_THRESHOLD=10            # 10%

# Check interval
ALERT_CHECK_INTERVAL=15             # 15 minutes
```

---

## Rollback Strategy

### Automatic Rollback

The system has built-in automatic rollback:

```typescript
// In comparisonEngineAdapter.ts
try {
  const result = await unifiedComparisonEngine.compare(pdfPaths);
  return result;
} catch (error) {
  // Automatic fallback to legacy
  console.warn('Unified engine failed, using legacy');
  return legacyEngine.compare(pdfPaths);
}
```

### Manual Rollback

If metrics indicate problems:

```bash
# Immediate rollback
export USE_UNIFIED_ENGINE=false

# Or reduce rollout
export USE_UNIFIED_ENGINE_ROLLOUT=10
```

### Rollback Criteria

Rollback immediately if:
- Fallback rate > 10%
- Error rate > 5%
- Processing time > 300s
- User complaints increase significantly

### Rollback Procedure

1. **Reduce rollout** to 10%
2. **Investigate** errors
3. **Fix issues**
4. **Re-test** with internal users
5. **Gradually increase** rollout again

---

## User-Specific Overrides

### Admin Override

```bash
# Always enable for specific users
USE_UNIFIED_ENGINE_USERS="admin@company.com,tester@company.com"
```

### Testing Override

```typescript
// Force enable for a request
featureFlags.updateFlag('useUnifiedComparisonEngine', true);

// Process with unified
const result = await comparisonEngineAdapter.generateComparison(pdfs, userId);
```

### Temporary Disable

```typescript
// Disable for specific user
unifiedComparisonFlag.updateRolloutPercentage(0);

// Or remove from enabled list
// (requires restart or dynamic config update)
```

---

## Configuration Reference

### Environment Variables

```bash
# Feature Flag
USE_UNIFIED_ENGINE=true|false

# Rollout
USE_UNIFIED_ENGINE_ROLLOUT=0-100

# User Override
USE_UNIFIED_ENGINE_USERS="user1,user2,user3"

# Gemini Model
GEMINI_MODEL=gemini-3.5-flash

# Timeout
UNIFIED_ENGINE_TIMEOUT=60000

# Cache TTL
UNIFIED_CACHE_TTL=86400
```

### Runtime API

```typescript
// Get current flags
GET /api/monitoring/alerts/config

// Update flags (admin only)
PUT /api/monitoring/alerts/config
Body: {
  "fallbackRateThreshold": 5,
  "processingTimeThreshold": 120000
}
```

### Database Flags

```sql
-- View current usage
SELECT 
  engine_type,
  COUNT(*) as count,
  AVG(processing_time_ms) as avg_time
FROM analysis_history
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY engine_type;
```

---

## Testing Strategy

### Pre-Deployment Testing

```bash
# Unit tests
npm test -- unifiedComparison

# Integration tests
npm test -- integration

# Performance tests
npm test -- performance
```

### Deployment Testing

```bash
# Deploy to staging
npm run deploy:staging

# Run smoke tests
npm run test:smoke

# Compare with production
npm run test:compare
```

### Production Validation

```bash
# Check first requests
GET /api/monitoring/unified-engine?days=1

# Verify no errors
GET /api/monitoring/errors?days=1

# Check user feedback
GET /api/monitoring/feedback?days=1
```

---

## Best Practices

### 1. Gradual Rollout

Always start with 0% rollout and specific users before enabling for everyone.

### 2. Monitor Metrics

Check metrics daily during rollout. Don't rely on user reports alone.

### 3. Have Rollback Plan

Always have a quick rollback plan ready.

### 4. Communicate Changes

Notify users of new features and potential changes in behavior.

### 5. Document Issues

Log all issues with correlation IDs for easy debugging.

### 6. Test Edge Cases

Test with various quote counts (1, 4, 8+) before full rollout.

### 7. Maintain Legacy

Keep legacy engine operational until unified is proven stable.

---

## Troubleshooting

### Feature Flag Not Working

```bash
# Check if flag is loaded
GET /api/monitoring/alerts/config

# Verify environment variable
echo $USE_UNIFIED_ENGINE

# Restart service if needed
railway service restart
```

### Rollout Not Working

```bash
# Check rollout config
GET /api/monitoring/unified-engine

# Verify user hash consistency
# Same user should get same result
```

### Unexpected Fallbacks

```bash
# Check error logs
GET /api/monitoring/errors

# Review fallback reasons
SELECT fallback_reason, COUNT(*) 
FROM analysis_history 
WHERE engine_type = 'fallback'
GROUP BY fallback_reason;
```

---

## Related Documentation

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [JSON Schema](./JSON_SCHEMA.md)
- [API Documentation](../API.md)