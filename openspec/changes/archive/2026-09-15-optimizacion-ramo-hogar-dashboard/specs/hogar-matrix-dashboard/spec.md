# Spec: Optimización del Ramo Hogar, Matriz y Dashboard de Brechas

## Requirements

### Requirement 1: Recharts ResponsiveContainer Restoration
`components/report/ReportCharts.tsx` and `components/AuditDashboard.tsx` MUST:
- Wrap chart components (`RadarChart`, `BarChart`) inside a `<ResponsiveContainer width="100%" height="100%">` within `<DeferredChart>`.
- Guarantee non-zero dimensions upon parent mounting so SVG graphics render correctly instead of staying blank.

### Requirement 2: Clean Corporate Insurer Isolation
`server/src/services/unifiedComparison/comparisonPromptBuilder.ts` and `server/src/controllers/analysisController.ts` MUST:
- In the LLM prompt, strictly instruct that `insurers` contains only corporate company names (e.g., `ALLIANZ`, `SBS`, `SURA`, `MAPFRE`, `BOLÍVAR`, `AXA COLPATRIA`, `CHUBB`, `SEGUROS DEL ESTADO`).
- Prohibit concatenating client names (`ISABEL CRISTINA VASCO`) or products (`HOGAR`) into `insurers`.
- Provide backend normalization in `analysisController.ts` and `matrixTransformer.ts` to strip extraneous client or product suffixes from table headers.

### Requirement 3: Domain-Aware Hogar Strategy & Percentage Resolution
`server/src/services/unifiedComparison/` MUST:
- Register a dedicated `hogarPromptStrategy` in `promptStrategyFactory.ts`.
- Pass `domain` to `comparisonPromptBuilder.ts` so `buildV2ComparisonPrompt` dynamically uses Hogar sections: `BIENES ASEGURADOS` (Edificio, Contenidos, Contenidos Especiales, Equipo Eléctrico), `COBERTURAS` (Amparo Básico Incendio, Terremoto, Daños por Agua, Granizo/Vendaval, RCE Familiar, Asistencia Domiciliaria), `DEDUCIBLES` and `FINANCIAL`.
- Instruct Gemini that whenever a coverage limit is expressed as a percentage (e.g. SURA "100%"), it MUST compute and display the monetary value based on the insured asset (e.g., `$250.000.000 (100%)`) instead of leaving "100%" alone.

### Requirement 4: Residential Typology & Deductibles Structure
`server/src/services/unifiedComparison/comparisonPromptBuilder.ts` MUST:
- Instruct the model to identify the policy modality: `Solo Edificio`, `Solo Contenidos`, or `Integral (Edificio + Contenidos)`.
- Extract per-coverage deductibles explicitly distinguishing nature events (% VA / % pérdida min SMMLV) from accidental events, and classify RCE/Asistencias as `Sin deducible` when no copay applies.

### Requirement 5: Semantic Distinction for Scoring
The comparison matrix and scoring pipeline MUST:
- Consistently distinguish:
  - `No Cotizado`: Module/asset outside policy scope (neutral or contextual indicator, not penalized).
  - `No Incluido` / `No Amparado`: Available coverage omitted/excluded in this quote (scored as coverage absence).
  - `Sin Deducible`: Zero deductible condition on covered amparo (scored as a positive benefit).

### Requirement 6: Clausulado Availability & UI Rebranding
`server/src/controllers/analysisController.ts` and `components/AuditSection.tsx` MUST:
- Dynamically set `isRagAvailable` based on available insurer clauses instead of hardcoding `false`.
- Rebrand "Auditoría de Riesgos" to "Análisis de Letra Chica y Brechas" in UI headers and navigation, with user-friendly descriptions explaining its consultative value.
