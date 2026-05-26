# Railway Deployment Guide

## Environment Variables to Update

After pushing code changes, update these variables in Railway Dashboard:

### Required Updates

| Variable | Old Value | New Value | Notes |
|----------|-----------|-----------|-------|
| `GEMINI_MODEL` | `models/gemini-2.5-flash` or `gemini-2.0-flash` | `models/gemini-3.5-flash` | PDF extraction model |
| `GEMINI_EMBEDDING_MODEL` | `models/gemini-embedding-001` or `text-embedding-004` | `models/gemini-embedding-2` | Embedding model |

### New Variables to Add

| Variable | Value | Purpose |
|----------|-------|---------|
| `GEMINI_CHAT_MODEL` | `models/gemini-2.5-flash-lite` | Chat/RAG conversations |
| `GEMINI_CLAUSE_MODEL` | `models/gemini-2.5-flash` | Structured clause extraction |

### Step-by-Step Instructions

1. **Open Railway Dashboard**
   - Go to https://railway.app/dashboard
   - Select your project

2. **Update Variables**
   - Navigate to "Variables" tab
   - Find `GEMINI_MODEL` → Edit → Set to `models/gemini-3.5-flash`
   - Find `GEMINI_EMBEDDING_MODEL` → Edit → Set to `models/gemini-embedding-2`
   - Click "New Variable" → Add `GEMINI_CHAT_MODEL` = `models/gemini-2.5-flash-lite`
   - Click "New Variable" → Add `GEMINI_CLAUSE_MODEL` = `models/gemini-2.5-flash`

3. **Deploy**
   - Railway will auto-deploy when variables change
   - Wait for deployment to complete (green checkmark)

4. **Verify**
   - Check deployment logs for errors
   - Test PDF upload to confirm extraction works
   - Test chat to confirm responses work

## Full Environment Variable List for Railway

```
GEMINI_API_KEY=AIzaSyBzvycI9jwp21ohcJyl3bKcPzFqSTrL7Z0
GEMINI_MODEL=models/gemini-3.5-flash
GEMINI_CHAT_MODEL=models/gemini-2.5-flash-lite
GEMINI_CLAUSE_MODEL=models/gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=models/gemini-embedding-2
SUPABASE_URL=https://nubiecwypgfekhvaffxm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=8080
NODE_ENV=production
REGION=CO
SMMLV_VALUE=1300000
UVT_VALUE=42412
CURRENCY=COP
CLAUSE_PAGES_BUCKET=clause-pages
```

## Post-Deployment Verification

```bash
# Check logs
railway logs

# Verify models are loading
curl https://your-app-url/health

# Test extraction
curl -X POST https://your-app-url/api/quotes/extract \
  -F "file=@test.pdf"
```

## Troubleshooting

### Deployment fails
- Check Railway build logs for TypeScript errors
- Verify all env vars are set correctly

### Model errors
- Check if model names need `models/` prefix
- Verify API key has access to specified models

### Embedding errors
- Confirm dimensionality matches (3072 for gemini-embedding-2)
- May need to re-index existing documents
