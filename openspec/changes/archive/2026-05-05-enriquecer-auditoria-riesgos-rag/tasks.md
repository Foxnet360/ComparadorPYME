# Tasks: Enriquecer Auditoría de Riesgos con RAG

## Backend

- [x] Create `server/src/services/auditEnrichmentService.ts`
  - [x] Implement `enrichAlertsWithRAG(alerts, insurerIds)` function
  - [x] Use `ragRetrievalService.hybridSearch()` to find relevant clause chunks per alert
  - [x] Match chunks to alerts by coverage type + insurer
  - [x] Return enriched alerts with evidence array (text, page, section, similarityScore)
  - [x] Fallback: when no clauses indexed, return basic technical analysis from quote data
- [x] Create `server/src/routes/audit.ts`
  - [x] POST /api/audit/enrich — receives report data, returns enriched alerts
  - [x] Validate input (alerts array, insurerIds array)
  - [x] Call auditEnrichmentService
  - [x] Return 200 with enrichedAlerts
- [x] Register new route in `server/src/index.ts` or server entry point
- [x] Add types for EnrichedAlert, Evidence, BusinessContextAnalysis

## Frontend

- [x] Create `components/AuditDashboard.tsx`
  - [x] Show severity counters (Critical/Warning/Good) at top
  - [x] Show stacked bar chart of risks per insurer (Recharts)
  - [x] Show cross-insurer risk matrix table
- [x] Create `components/EvidenceCard.tsx`
  - [x] Display clause text with citation
  - [x] Show page/section, similarity score, confidence badge
  - [x] Expandable/collapsible
- [x] Redesign `components/AuditSection.tsx`
  - [x] Add "Enriquecer con Clausulados" button (only when clauses available)
  - [x] Add loading state for enrichment
  - [x] Display AuditDashboard at top
  - [x] Display alerts with EvidenceCards
  - [x] Add business context analysis panel
  - [x] Cache enriched results in sessionStorage
- [x] Create hooks: `useAuditEnrichment()` to call /api/audit/enrich
- [x] Check clause availability: query Supabase for indexed clauses by insurer

## Integration & Testing

- [x] Test enrichment with real clause data
- [x] Test fallback mode (no clauses)
- [x] Verify button visibility logic
- [x] Run `npm run build` to verify no errors
