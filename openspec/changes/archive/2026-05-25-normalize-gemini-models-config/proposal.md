## Why

The project currently has inconsistent and outdated Gemini model configurations across multiple files. The `.env` file uses `gemini-2.5-flash` and `gemini-embedding-001`, while the code defaults to `gemini-3.5-flash` and `gemini-embedding-2`. Additionally, the structured clause extractor uses a hardcoded model name without environment variable configuration. This inconsistency causes confusion, potential runtime errors, and makes it difficult to switch models for different environments (development, staging, production).

## What Changes

- **Update `.env` file**: Set `GEMINI_MODEL=gemini-3.5-flash`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-2`, and add `GEMINI_CHAT_MODEL=gemini-2.5-flash-lite` and `GEMINI_CLAUSE_MODEL=gemini-2.5-flash`
- **Make clause extractor configurable**: Replace hardcoded `gemini-2.5-flash` in `structuredClauseExtractor.ts` with `process.env.GEMINI_CLAUSE_MODEL`
- **Update documentation**: Sync `STAGING_GUIDE.md`, `RAILWAY_DEPLOY.md`, `README.md`, and `.env.example` with correct model names and new variables
- **Verify all model references**: Audit entire codebase for any remaining hardcoded or inconsistent model names

## Capabilities

### New Capabilities
- `gemini-model-configuration`: Centralized configuration for all Gemini AI models used in the system

### Modified Capabilities

## Impact

- **Code**: `server/.env`, `server/.env.example`, `server/src/services/structuredClauseExtractor.ts`
- **Documentation**: `README.md`, `STAGING_GUIDE.md`, `RAILWAY_DEPLOY.md`, `ARCHITECTURE.md`
- **Deployment**: Requires updating environment variables in Railway dashboard
- **No breaking changes**: All changes are backward compatible with fallbacks to existing behavior
