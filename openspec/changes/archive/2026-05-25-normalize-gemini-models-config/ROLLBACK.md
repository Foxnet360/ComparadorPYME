# Rollback Plan - Gemini Model Normalization

## Previous Values (Pre-Change)

If the new model configuration causes issues, revert to these values:

```env
# Previous model configuration (before normalize-gemini-models-config)
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
# Note: GEMINI_CHAT_MODEL and GEMINI_CLAUSE_MODEL did not exist before
```

## Rollback Steps

### 1. Local Development
```bash
# Edit server/.env and revert:
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
# Remove or comment out:
# GEMINI_CHAT_MODEL=gemini-2.5-flash-lite
# GEMINI_CLAUSE_MODEL=gemini-2.5-flash
```

### 2. Railway Production
1. Go to Railway Dashboard → Your Project → Variables
2. Update these environment variables:
   - `GEMINI_MODEL` → `gemini-2.0-flash` (or `models/gemini-2.0-flash`)
   - `GEMINI_EMBEDDING_MODEL` → `text-embedding-004` (or `models/text-embedding-004`)
   - Remove `GEMINI_CHAT_MODEL` (code has fallback)
   - Remove `GEMINI_CLAUSE_MODEL` (code has fallback)
3. Railway will redeploy automatically

### 3. Code Rollback (if needed)
```bash
# Revert structuredClauseExtractor.ts to use hardcoded model
git checkout HEAD -- server/src/services/structuredClauseExtractor.ts

# Or manually edit to restore:
# model: 'gemini-2.5-flash',
```

## Verification After Rollback

1. Check Railway logs for successful startup
2. Verify PDF extraction works with old model
3. Confirm embeddings still generate correctly
4. Check chat functionality

## Common Issues & Solutions

### Issue: "Model not found" after rollback
**Cause**: Railway might cache the old model name
**Solution**: Redeploy manually from Railway Dashboard

### Issue: Embeddings dimension mismatch
**Cause**: `text-embedding-004` generates 768 dims vs `gemini-embedding-2`'s 3072
**Solution**: Re-index documents if switching between models

### Issue: Chat not working
**Cause**: Missing `GEMINI_CHAT_MODEL` fallback should work
**Solution**: Check logs for actual error message
