# Design: Corregir Reporte Comparativo (V2 Engine Integration)

## Technical Approach

We will integrate the single-call comparison engine (V2) back into the main architecture. Instead of bypassing the existing services, the parsed cells and rows will be fed into the robust authentication, currency parsing, semantic ontology mapping, dynamic scoring (`quoteScorer`), and rule-based audit (`quoteBasedAuditor`) pipelines, populating full technical attributes for the frontend views.

---

## Architecture Decisions

| Area | Option | Tradeoff | Decision |
| :--- | :--- | :--- | :--- |
| **Auth** | Force auth vs Optional auth | Forced auth blocks guest conversion. Optional auth allows anonymous comparisons with zero persistence. | **Optional JWT decoding** via `optionalAuthMiddleware` in comparison endpoints. |
| **Parsing** | Regex vs Custom currency parser | Regex breaks on decimals (e.g. Allianz x100). Custom parser handles es-CO dot/comma formats. | **Shared es-CO utility parser** `parseColombianCurrency` under `server/src/utils/`. |
| **Ontology** | Direct mapping vs normalizer pipeline | Direct mapping ignores fuzzy/embeddings. Normalizer utilizes exact, fuzzy, embedding, and template graph. | **Integrate `coverageNormalizer`** within the matrix-to-report converter. |
| **Scoring** | Inline math vs `quoteScorer` reuse | Inline is faster but duplicates rules. Reuse maintains consistency across V1 and V2 engines. | **Convert V2 matrix to `ParsedQuote[]`** and pass it to `quoteScorer` / `quoteBasedAuditor`. |

---

## Data Flow

```
[Request with JWT] ──→ optionalAuthMiddleware (req.user.id)
                             │
[PDF Uploads]      ──→ comparisonEngineAdapter (V2 Engine)
                             │
[MatrixRow[]]      ──→ matrixRowsToComparisonReport()
                             ├─→ parseColombianCurrency (Annual Premium)
                             ├─→ coverageNormalizer (canonicalName, categoryId)
                             ├─→ quoteScorer (Dynamic weights, Score breakdown)
                             ├─→ quoteBasedAuditor (Risk audit, special conditions)
                             └─→ Sync extracted metadata & clients to client_profiles
```

---

## File Changes

| File | Action | Description |
| :--- | :--- | :--- |
| `server/src/routes/comparisonRoutes.ts` | Modify | Secure `/unified` and `/:id/deep-mode` using `optionalAuthMiddleware`. Pass decoded user ID. |
| `server/src/utils/currencyParser.ts` | Create | New currency parsing utility for Colombian dot/comma formats. |
| `server/src/controllers/analysisController.ts`| Modify | Revamp `matrixRowsToComparisonReport`. Integrate normalizer, currency parser, scoring, and auditing. |
| `components/UnifiedCoverageMatrix.tsx` | Modify | Format semicolon deductibles and toggle technical evidence metadata by `viewMode`. |
| `components/DeductibleBadge.tsx` | Modify | Support rendering semicolon-delimited lists as clean stacked list items. |

---

## Interfaces / Contracts

```typescript
// server/src/utils/currencyParser.ts
export function parseColombianCurrency(valueStr: string | null | undefined): number | null;

// Extracted company sync under user_id inside analysisController.ts
interface ClientProfileSync {
  user_id: string;
  client_name: string;
  primary_activity: string;
  location_city: string;
  raw_client_data: Record<string, unknown>; // holds address, totalInsuredValue, ciiu, etc.
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
| :--- | :--- | :--- |
| **Unit** | `parseColombianCurrency` | Assert standard/Colombian string inputs (`$1.134.400,00`, `$1.134.400`, `1134400.00`) parse to `1134400.00`. |
| **Unit** | `matrixRowsToComparisonReport` | Mock `coverageNormalizer` and `quoteScorer` to verify real dynamic ratings are computed. |
| **Integration** | `comparisonRoutes.ts` | Call `/unified` with/without Bearer token; verify DB syncing occurs only when authenticated. |
| **E2E/Visual** | Deductible Semicolons | Assert strings with `;` render multiple stacked badges. Verify Técnico toggle state changes visible fields. |

---

## Migration / Rollout

1. **Database Schema Sync**: Apply a schema migration adding `user_id TEXT`, `client_name TEXT`, and `raw_client_data JSONB` columns to `client_profiles` if not already present.
2. **Security Remediation (CRITICAL)**: Present SQL to enable Row-Level Security (RLS) on `client_profiles` and matching tables, adding standard owner-only select policies (`user_id = auth.uid()::text`).
3. **Rollback**: Feature flag `granularComparisonSchema = false` instantly rolls back to legacy V1 schema representation.

---

## Open Questions

- [ ] Should we automatically retrain or cache the unmapped coverage mappings under standard human review status in `coverage_mappings`? *(Deferred to downstream)*
- [ ] Are guest comparisons cached temporarily on Redis? *(Yes, caching already operates on file hashes, keeping performance optimal without DB persistence)*
