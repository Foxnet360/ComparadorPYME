## Context

The project uses Google Gemini models across multiple services:
- **PDF extraction** (multimodal): Currently defaults to `gemini-3.5-flash` in code, but `.env` overrides to `gemini-2.5-flash`
- **Chat/RAG**: Uses `gemini-2.5-flash-lite` via `GEMINI_CHAT_MODEL` env var
- **Embeddings**: Code defaults to `gemini-embedding-2`, but `.env` uses `gemini-embedding-001`
- **Structured clause extraction**: Hardcoded to `gemini-2.5-flash` without environment variable

This inconsistency makes it unclear which models are actually in use and complicates model switching for testing or cost optimization.

## Goals / Non-Goals

**Goals:**
- Standardize all model references to use consistent, current model names
- Make all model selections configurable via environment variables
- Update documentation to reflect actual model configuration
- Ensure backward compatibility (fallbacks work if env vars are missing)

**Non-Goals:**
- Changing actual model behavior or capabilities
- Adding new AI features
- Modifying the extraction logic or prompts
- Performance benchmarking between models

## Decisions

### 1. Use `gemini-3.5-flash` as default for PDF extraction
**Rationale**: This is the latest model and the user confirmed it exists and performs well. The code already defaults to this, so we align `.env` with the code.

**Alternative considered**: Keep `gemini-2.5-flash` in `.env` - rejected because the user wants to use the newer model.

### 2. Add `GEMINI_CLAUSE_MODEL` as new environment variable
**Rationale**: Structured clause extraction currently uses hardcoded `gemini-2.5-flash`. Making it configurable allows testing different models for legal text extraction without code changes.

**Alternative considered**: Use `GEMINI_MODEL` for everything - rejected because clause extraction might need a different model than PDF extraction (text-only vs multimodal).

### 3. Use `gemini-embedding-2` consistently
**Rationale**: The embedding service code defaults to `gemini-embedding-2`, which is the newer model. We align `.env` with the code default.

**Alternative considered**: Keep `gemini-embedding-001` - rejected because the newer model should be the default.

### 4. Keep `gemini-2.5-flash-lite` for chat
**Rationale**: User confirmed this model works fast for chat. No change needed.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `gemini-3.5-flash` might not be available for all API keys/regions | Keep fallback to `gemini-2.5-flash` in code; document requirement |
| Changing embedding model might affect vector similarity | Test with existing clause documents after deploy |
| Environment variable proliferation | Only 4 variables total; all have clear purposes |

## Migration Plan

1. Update `.env` and `.env.example` files
2. Update `structuredClauseExtractor.ts` to read `GEMINI_CLAUSE_MODEL`
3. Update all documentation references
4. Deploy to Railway with updated env vars
5. Verify all services start correctly

## Open Questions

None - all decisions confirmed with user.
