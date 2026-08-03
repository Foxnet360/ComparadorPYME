## 1. Spatial Layout Pre-Processing

- [x] 1.1 Implement PDF coordinate parser to extract text bounding boxes ($X,Y$).
- [x] 1.2 Build spatial table reconstruction module linking coverage descriptions, amounts, and deductibles by vertical/horizontal alignment.
- [x] 1.3 Add fallback handler for unstructured or descriptive PDF text layouts.

## 2. Page Router and Intelligent Chunking

- [x] 2.1 Implement header scanner to classify PDF pages into types (`SUMMARY`, `COVERAGE_SCHEDULE`, `DEDUCTIBLE_TERMS`, `GENERAL_CONDITIONS`).
- [x] 2.2 Add page filtering utility to trim documents exceeding 5 pages down to high-value pages before LLM invocation.
- [x] 2.3 Write unit tests verifying page pruning behavior for multi-page vs short PDFs.

## 3. Insurer Fingerprinting and Template Registry (Engram Integration)

- [x] 3.1 Extend `templateRegistrySchema` with visual and textual fingerprint patterns for Sura, AXA Colpatria, Mapfre, SBS, and Bolívar.
- [x] 3.2 Implement template matcher service with Engram memory persistence for insurer-specific extraction hints.
- [x] 3.3 Add few-shot prompt injector to supply template-specific examples to LLM prompts.

## 4. Multi-Stage Cascade Extraction Pipeline

- [x] 4.1 Create 3-stage extraction orchestrator (`Stage 1: Policy/Primas`, `Stage 2: Coverages`, `Stage 3: Deductibles/Norms`).
- [x] 4.2 Build payload merger to assemble stage outputs into `InsuranceAnalysisResult` without data corruption.
- [x] 4.3 Add parallel execution support for independent extraction stages.

## 5. Deterministic Post-Processing and Financial Reconciliation

- [x] 5.1 Implement financial reconciler validating `netPremium + taxes + fees == totalPayable`.
- [x] 5.2 Add targeted re-prompt trigger when mathematical discrepancies exceed 1 COP.
- [x] 5.3 Implement mandatory coverage auditor to assign explicit fallback flags ("No aplica" / "Ver clausulado") for missing required domain coverages.

## 6. Verification and Integration Testing

- [x] 6.1 Update vitest suite in `server/src/services/unifiedComparison/__tests__/` to test multi-template pipeline.
- [x] 6.2 Execute regression test run verifying all 35 existing domain taxonomy tests pass.
