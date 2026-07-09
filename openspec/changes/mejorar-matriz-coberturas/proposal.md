# Proposal: Mejorar Matriz Coberturas

## Intent
Align PDF extraction and frontend rendering with the business reference template. This stops discarding backend-structured matrices, extracts metadata/granular details, and resolves row grouping inconsistencies.

## Scope

### In Scope
- **Extraction Expansion**: Support header metadata (Client, Seguro, Ubicación, Año, Pisos, Aliado, Actividad, Documento, Vigencia), "Bienes Asegurados" (Mercancías, Muebles, Maquinaria, Equipo, Asistencia), "Deducibles" (Incendio, Anegación, Terremoto, HMACC-AMIT), "Sustracción", and financial terms.
- **Frontend Sync**: Pass the pre-aligned matrix rows from `ComparisonReport` directly to `UnifiedCoverageMatrix`, align tab filtering with backend V2 section IDs, and render a metadata header card.
- **2-PR Chained Delivery**:
  - **PR 1**: Backend expansion (schemas, prompts, parser, API payload, tests).
  - **PR 2**: Frontend synchronization & UI rendering (matrix binding, header card, fallback logic).

### Out of Scope
- Redesigning visual styling beyond standard UI cards.
- Support for offline analysis or non-PDF formats.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `unified-comparison-extraction`: Expand extraction prompts and schema to capture new granular coverages, deductibles, and structured client metadata.
- `unified-coverage-matrix`: Bind the backend-provided matrix rows directly to the UI, align tab filter logic, and render the structured header metadata.

## Approach
Implement Dual-Layer Synchronization using a **Feature Branch Chain** strategy:
1. **Backend Expansion**: Extend the V2 JSON schema, prompt suggestions, and flat table parser to capture client metadata and specific insurance sections. Update the API response to include the aligned matrix structure.
2. **Frontend Sync**: Update `ComparisonReport` to pass backend matrix rows. Modify `UnifiedCoverageMatrix` to use pre-aligned backend rows and render a responsive metadata header card.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `server/src/services/unifiedComparison/comparisonPromptBuilder.ts` | Modified | Add granular row suggestions and metadata prompts. |
| `server/src/services/unifiedComparison/comparisonSchema.ts` | Modified | Expand schema with header metadata and validate V2 section mappings. |
| `server/src/services/unifiedComparison/flatTableParser.ts` | Modified | Update aliases dictionary and validation heuristics. |
| `server/src/controllers/analysisController.ts` | Modified | Map and return structured backend matrix rows. |
| `components/ComparisonReport.tsx` | Modified | Forward backend matrix rows to visual matrix. |
| `components/UnifiedCoverageMatrix.tsx` | Modified | Consume backend matrix rows and render metadata card. |
| `types.ts` & `server/src/types.ts` | Modified | Add `headerMetadata` and matrix-related definitions. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prompt size token overhead | Low | Gemini 3.5 Flash handles large prompts with minimal cost. |
| Legacy cache compatibility | Medium | Implement solid fallback parsing in frontend for v1 cached results. |

## Rollback Plan
Revert both PRs to the previous feature branches. Ensure database extraction queries degrade gracefully to V1 schemas.

## Dependencies
- Active `granularComparisonSchema` feature flag enabled.

## Success Criteria
- [ ] Grouped extraction handles all 5 target business categories.
- [ ] No manual client-side fallback triggers when backend matrix is present.
- [ ] Header metadata renders in a responsive card above the matrix.
