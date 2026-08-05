# Requirement: Extraction Quality & Context Caching Optimization

## Requirement: Expanded Verbatim Snippet Window
The extraction engine MUST capture contiguous text snippets between 50 and 300 characters in `rawTextSnippet` to ensure nested sub-limits and complex coverage clauses are captured without truncation.

## Requirement: Defensive Composite Deductible Parsing
The `hybridDeductibleParser` MUST parse composite deductibles (combinations of percentage, fixed amounts, SMMLV, UVT, minimums, and maximums) and MUST preserve the unparsed string as fallback if structure extraction fails.

## Requirement: Controlled Gemini Context Caching
When `ENABLE_GEMINI_CONTEXT_CACHING` is enabled and input documents exceed the token threshold (32,000 tokens), the system MUST create or reuse a Gemini `cachedContent` handle. If cache creation or invocation fails, the engine MUST fall back to standard `generateContent` invocation.

## Requirement: Safe Graph Canonicalization Fallback
When `useUnifiedGraphCanonicalization` feature flag is active, coverage normalization MUST use graph edge mappings. If the match confidence is below 0.7, the engine MUST fall back to static thesaurus matching.
