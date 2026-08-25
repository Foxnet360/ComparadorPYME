# Archive Report: Mejora Coherencia UX Negocio

## Change Overview
- **Change Name**: `mejora-coherencia-ux-negocio`
- **Archived Date**: 2026-08-25
- **Status**: Verified & Completed

## Key Accomplishments
1. **Resilient Retry Flow**: Modifed `App.tsx` error state to preserve uploaded quote files, clause files, selected client, and selected clauses on error.
2. **Correction Propagation**: Connected `CorrectionUI.tsx` manual edits with global `report` state and PDF export generation.
3. **Domain & Client UX Alignment**: Extracted domain selector (PYME / Autos) to top configuration bar in `App.tsx` and added feedback for client selection in `FileUploader.tsx`.
4. **Domain-Aware Presentation**: Adapted `ComparisonReport.tsx` labels and metric cards dynamically according to `report.domain`.
