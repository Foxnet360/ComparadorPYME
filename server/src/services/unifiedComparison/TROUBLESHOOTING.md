# Troubleshooting Guide: Unified Comparison Engine

## Overview

This guide helps diagnose and resolve common issues with the Unified Comparison Engine.

## Quick Diagnostics

### Check Engine Status
```bash
# Check if unified engine is enabled
GET /api/monitoring/dashboard

# Check engine comparison metrics
GET /api/monitoring/engine-comparison

# Check active alerts
GET /api/monitoring/alerts

# Check error tracking
GET /api/monitoring/errors
```

### Check Logs
```bash
# View recent unified engine logs
tail -f logs/unified-engine-$(date +%Y-%m-%d).log

# Search for errors
grep "ERROR" logs/unified-engine-$(date +%Y-%m-%d).log

# Search by correlation ID
grep "corr-12345" logs/unified-engine-$(date +%Y-%m-%d).log
```

## Common Issues

### 1. High Fallback Rate (>5%)

**Symptoms:**
- Alert: "High fallback rate detected"
- Most comparisons use legacy engine
- Users report slower processing times

**Possible Causes:**
1. **Gemini API issues** - Service unavailable or rate limiting
2. **PDF upload failures** - Files too large or corrupted
3. **JSON parsing errors** - Malformed responses from Gemini
4. **Schema validation failures** - Missing required fields

**Solutions:**

1. **Check Gemini API status**
   ```bash
   # Check if Gemini API is accessible
   curl -I https://generativelanguage.googleapis.com
   ```

2. **Check PDF file sizes**
   ```bash
   # Maximum file size is 20MB per file
   ls -lh uploads/
   ```

3. **Enable debug logging**
   ```javascript
   // In environment variables
   LOG_LEVEL=debug
   ```

4. **Monitor specific error types**
   ```bash
   GET /api/monitoring/errors?category=gemini_api
   GET /api/monitoring/errors?category=pdf_upload
   ```

### 2. Processing Time > 60 Seconds

**Symptoms:**
- Alert: "High average processing time"
- Users report timeouts
- Performance degradation

**Possible Causes:**
1. **Large PDF files** - Files > 10MB take longer to process
2. **Many quotes** - 8+ quotes in a single request
3. **Network latency** - Slow connection to Gemini API
4. **No cache hits** - Cache not working properly

**Solutions:**

1. **Check file sizes**
   ```bash
   # List files with sizes
   ls -lh uploads/ | sort -k5 -rn | head -10
   ```

2. **Verify cache is working**
   ```bash
   # Check cache logs
   grep "Cache hit" logs/unified-engine-$(date +%Y-%m-%d).log | wc -l
   grep "Cache miss" logs/unified-engine-$(date +%Y-%m-%d).log | wc -l
   ```

3. **Limit concurrent requests**
   ```javascript
   // In analysisController.ts
   const CONCURRENCY_LIMIT = 2; // Reduce if needed
   ```

4. **Check Redis availability**
   ```bash
   # Redis should be available for cache
   GET /api/monitoring/dashboard
   # Look for redis status in systemHealth
   ```

### 3. PDF Upload Failures

**Symptoms:**
- Error: "Failed to upload PDF"
- Error: "PDF file too large"
- Error: "Invalid file type"

**Solutions:**

1. **Check file format**
   ```bash
   # Verify file is valid PDF
   file uploads/*.pdf
   ```

2. **Check file size**
   ```bash
   # Maximum size: 20MB
   find uploads/ -size +20M
   ```

3. **Re-upload file**
   ```bash
   # Remove corrupted file and re-upload
   rm uploads/corrupted.pdf
   ```

4. **Check disk space**
   ```bash
   df -h /tmp
   df -h /app/uploads
   ```

### 4. JSON Parsing Errors

**Symptoms:**
- Error: "JSON parsing failed"
- Error: "Invalid validation response format"
- Malformed comparison results

**Solutions:**

1. **Check Gemini response**
   ```bash
   # Enable debug logging to see raw responses
   LOG_LEVEL=debug
   ```

2. **Retry with correction prompt**
   ```javascript
   // The engine automatically retries with correction prompt
   // Check retry logs
   grep "Retry attempt" logs/unified-engine-$(date +%Y-%m-%d).log
   ```

3. **Validate response manually**
   ```bash
   # Use the excel structure validator
   node -e "const {validateAgainstExcelStructure} = require('./dist/services/unifiedComparison/excelStructureValidator'); console.log(validateAgainstExcelStructure(result));"
   ```

### 5. Cache Issues

**Symptoms:**
- Cache miss rate is high
- No performance improvement
- Redis connection errors

**Solutions:**

1. **Check Redis connection**
   ```bash
   # Redis should show as connected
   GET /api/monitoring/dashboard
   ```

2. **Clear cache**
   ```bash
   # Restart Redis or clear cache
   redis-cli FLUSHDB
   ```

3. **Check cache configuration**
   ```javascript
   // Cache TTL: 1 day for comparison results
   // Check if Redis URL is configured
   echo $REDIS_URL
   ```

4. **Fallback to memory cache**
   ```bash
   # If Redis is unavailable, system uses in-memory cache
   # Check logs for: "Using in-memory cache fallback"
   ```

### 6. Feature Flag Issues

**Symptoms:**
- Unified engine not being used
- Feature flag shows as disabled
- Rollout percentage not working

**Solutions:**

1. **Check feature flag status**
   ```bash
   GET /api/monitoring/dashboard
   # Check systemHealth for feature flags
   ```

2. **Verify environment variable**
   ```bash
   echo $USE_UNIFIED_ENGINE
   # Should be "true" to enable
   ```

3. **Check rollout percentage**
   ```javascript
   // Current rollout settings
   GET /api/monitoring/unified-engine
   ```

4. **Override for specific user**
   ```bash
   # Add user to override list
   export USE_UNIFIED_ENGINE_USERS="user1@example.com,user2@example.com"
   ```

### 7. Deep Mode Validation Issues

**Symptoms:**
- Error: "No clause files provided"
- Validation discrepancies not detected
- Deep mode timeout

**Solutions:**

1. **Verify clause files exist**
   ```bash
   # Check clause documents in database
   SELECT * FROM documents WHERE document_type = 'CLAUSULADO_GENERAL';
   ```

2. **Check clause file format**
   ```bash
   # Must be valid PDF
   file clauses/*.pdf
   ```

3. **Increase timeout for deep mode**
   ```javascript
   // Deep mode takes longer due to additional processing
   // Default timeout: 120 seconds
   ```

### 8. Memory Issues

**Symptoms:**
- Out of memory errors
- Container restarts
- Slow performance

**Solutions:**

1. **Check memory usage**
   ```bash
   GET /api/monitoring/dashboard
   # Check systemHealth.memory
   ```

2. **Clear old cached results**
   ```bash
   # Remove old cache entries
   redis-cli --eval clear-old-cache.lua
   ```

3. **Limit concurrent comparisons**
   ```javascript
   // Reduce concurrency
   const CONCURRENCY_LIMIT = 1;
   ```

4. **Restart service**
   ```bash
   # Restart to clear memory
   railway service restart
   ```

## Error Codes Reference

| Error Code | Description | Solution |
|-----------|-------------|----------|
| `GEMINI_503` | Gemini service unavailable | Wait and retry |
| `GEMINI_429` | Rate limit exceeded | Reduce request frequency |
| `PDF_UPLOAD_FAILED` | PDF upload failed | Check file size and format |
| `JSON_PARSE_ERROR` | Invalid JSON response | Enable debug logging |
| `SCHEMA_VALIDATION_FAILED` | Output doesn't match schema | Check Gemini model version |
| `CACHE_ERROR` | Cache operation failed | Check Redis connection |
| `TIMEOUT` | Request timeout | Increase timeout or reduce file size |
| `UNKNOWN_ERROR` | Unexpected error | Check logs for details |

## Monitoring Endpoints

### Get Engine Metrics
```bash
GET /api/monitoring/unified-engine?days=7
```

### Get Engine Comparison
```bash
GET /api/monitoring/engine-comparison?start=2024-01-01&end=2024-01-31
```

### Get Active Alerts
```bash
GET /api/monitoring/alerts
```

### Get Error Summary
```bash
GET /api/monitoring/errors?start=2024-01-01&end=2024-01-31
```

### Get Errors by Category
```bash
GET /api/monitoring/errors?category=gemini_api&start=2024-01-01&end=2024-01-31
```

### Acknowledge Alert
```bash
POST /api/monitoring/alerts/{id}/acknowledge
```

### Resolve Error
```bash
POST /api/monitoring/errors/{id}/resolve
Body: { "resolution": "Fixed by restarting service" }
```

## Support

For issues not covered in this guide:
1. Check structured logs: `logs/unified-engine-YYYY-MM-DD.log`
2. Search by correlation ID for request tracing
3. Check monitoring dashboard: `GET /api/monitoring/dashboard`
4. Review error tracking: `GET /api/monitoring/errors`

## Related Documentation

- [Feature Flags Configuration](./FEATURE_FLAGS.md)
- [API Documentation](./API.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Performance Benchmarks](./PERFORMANCE.md)