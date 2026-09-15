# Spec: Robustez de Extracción Multicotización y Reparación de JSON

## Requirements

### Requirement 1: Markdown Code Fence Stripping & Robust JSON Detection
`server/src/services/unifiedComparison/flatTableParser.ts` and `server/src/services/jsonRepair.ts` MUST:
- Strip markdown fences (` ```json `, ` ``` `, etc.) and leading/trailing whitespace before inspecting response formats.
- Correctly classify any valid JSON object as format `'json'` in `detectFormat(raw)` even if surrounded by markdown delimiters.
- Ensure `parseJsonV2` receives cleanly stripped JSON so standard parsing succeeds on the first attempt.

### Requirement 2: Uncut Response & Contextual Correction Prompting
`server/src/services/unifiedComparison/comparisonPromptBuilder.ts` MUST:
- In `buildV2CorrectionPrompt(originalResponse, errorMessage)` and `buildCorrectionPrompt`, NEVER truncate `originalResponse` to a fixed 1,000 characters.
- If size limits require pruning, preserve the full structural context (`insurers`, `quoteMetadata`, and existing parsed `rows`) or isolate the specific malformed snippet instead of chopping off 95% of the response.

### Requirement 3: Granular V2 Partial Repair in `jsonRepair.ts`
`server/src/services/jsonRepair.ts` MUST:
- Add a recovery strategy for V2 granular comparison objects containing `{ insurers: [...], rows: [...] }`.
- When an object is terminated prematurely (due to token limits or closing brace truncation), close open row/cell arrays and return all recovered rows rather than returning empty/null.

### Requirement 4: Preserved Multimodal File References on LLM Retries
`server/src/services/unifiedComparison/unifiedComparisonEngine.ts` MUST:
- If a correction prompt is issued to Gemini after an unrecoverable parse failure, include the uploaded PDF files (`uploadedFiles`) in `contents` so the model can inspect the original source documents instead of hallucinating minimal dummy tables without premiums or deductibles.
