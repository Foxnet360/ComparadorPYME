# Tasks: Enriquecer Auditoría de Riesgos con RAG

## Backend

- [ ] Create `server/src/services/auditEnrichmentService.ts`
  - [ ] Implement `enrichAlertsWithRAG(alerts, insurerIds)` function
  - [ ] Use `ragRetrievalService.hybridSearch()` to find relevant clause chunks per alert
  - [ ] Match chunks to alerts by coverage type + insurer
  - [ ] Return enriched alerts with evidence array (text, page, section, similarityScore)
  - [ ] Fallback: when no clauses indexed, return basic technical analysis from quote data
- [ ] Create `server/src/routes/audit.ts`
  - [ ] POST /api/audit/enrich — receives report data, returns enriched alerts
  - [ ] Validate input (alerts array, insurerIds array)
  - [ ] Call auditEnrichmentService
  - [ ] Return 200 with enrichedAlerts
- [ ] Register new route in `server/src/index.ts` or server entry point
- [ ] Add types for EnrichedAlert, Evidence, BusinessContextAnalysis

## Frontend

- [ ] Create `components/AuditDashboard.tsx`
  - [ ] Show severity counters (Critical/Warning/Good) at top
  - [ ] Show stacked bar chart of risks per insurer (Recharts)
  - [ ] Show cross-insurer risk matrix table
- [ ] Create `components/EvidenceCard.tsx`
  - [ ] Display clause text with citation
  - [ ] Show page/section, similarity score, confidence badge
  - [ ] Expandable/collapsible
- [ ] Redesign `components/AuditSection.tsx`
  - [ ] Add "Enriquecer con Clausulados" button (only when clauses available)
  - [ ] Add loading state for enrichment
  - [ ] Display AuditDashboard at top
  - [ ] Display alerts with EvidenceCards
  - [ ] Add business context analysis panel
  - [ ] Cache enriched results in sessionStorage
- [ ] Create hooks: `useAuditEnrichment()` to call /api/audit/enrich
- [ ] Check clause availability: query Supabase for indexed clauses by insurer

## Integration & Testing

- [ ] Test enrichment with real clause data
- [ ] Test fallback mode (no clauses)
- [ ] Verify button visibility logic
- [ ] Run `npm run build` to verify no errors
