# Spec: Corregir Reporte Comparativo (V2 Engine Integration)

This delta specification defines the requirements for integrating the unified single-call comparison engine (V2) back with authentication, Colombian premium formatting, semantic ontology, dynamic scoring, audit generation, and client/técnico dual visual rendering.

## Non-Goals & Edge Cases

| Area | Non-Goals | Edge Cases & Fallbacks |
| :--- | :--- | :--- |
| **Multimodal Pipeline** | Redesigning layout analysis. | Empty/malformed PDFs fallback to informative UI warnings. |
| **Authentication** | Enforcing strict auth on all legacy endpoints. | Anonymous guests access unpersisted comparisons. |
| **Semantic Mapping** | Creating new ontologies or categories. | Unmapped items default to "extraRows" marked as "unmapped". |

---

## PR 1: Auth & User-Scoped Persistence

### Functional Requirements
- `/api/comparison/unified` routes MUST utilize standard `authMiddleware` for extraction/retrieval.
- Active comparisons and companies MUST be stored in Supabase under the authenticated `user_id` when present.
- Guest sessions MUST gracefully fallback to unpersisted anonymous runs.

### Scenarios
#### Scenario: Authenticated user comparison syncs to database
- **GIVEN** a request contains a valid Supabase JWT in the `Authorization` header
- **WHEN** the user triggers comparison extraction
- **THEN** the server SHALL associate the record with the user's ID
- **AND** save the extracted client company under the user's Supabase account

#### Scenario: Anonymous guest comparison bypasses persistence
- **GIVEN** a request with no token
- **WHEN** comparison extraction runs
- **THEN** the system SHALL return the result directly
- **AND** SHALL NOT write any record to Supabase

---

## PR 2: Premium Decimal Parsing

### Functional Requirements
- Extractors MUST accurately parse Colombian currency values (e.g., `$1.134.400,00`, `$1.134.400`, `1134400.00`).
- The premium parser MUST NOT overflow, multiply by 100, or return integer-truncated prices.
- If unparseable, the parser SHALL fallback to the original string, not a zero or garbage number.

### Scenarios
#### Scenario: Parsing standard Colombian premium format
- **GIVEN** a premium string of `$1.134.400,00` or `$1.134.400`
- **WHEN** the premium decimal parser processes the value
- **THEN** the output numeric value is exactly `1134400.00`

---

## PR 3: Semantic Ontology Integration

### Functional Requirements
- Unified engine row outputs MUST be normalized through `coverageNormalizer` and `thesaurusMapper`.
- Mapped rows SHALL receive an ontology-compliant `categoryId` and `canonicalName`.
- Unmapped rows MUST NOT be dropped; they SHALL be grouped as exclusive coverages under "unmapped".
- Top comparison matrix MUST render only canonical/mapped rows.
- Bottom comparison section MUST exclude non-coverage info (billing/payment terms).

### Scenarios
#### Scenario: Normalized canonical row matching
- **GIVEN** raw extraction containing "Bienes bajo tierra"
- **WHEN** passed through semantic thesaurus mapping
- **THEN** the row SHALL be assigned categoryId "BIENES" and canonicalName "Bienes Bajo Tierra"

---

## PR 4: Dynamic Scoring & Risk Audit

### Functional Requirements
- Quote scores MUST be computed per-insurer by `quoteScorer`.
- Real `extractionConfidence` values MUST be calculated from extraction heuristics rather than returning a static 85.
- Real risk parameters, advantages, and conditions MUST be processed via `quoteBasedAuditor`.

### Scenarios
#### Scenario: Dynamically computed quote analysis scores
- **GIVEN** a valid extracted quote structure
- **WHEN** requested to compute comparisons
- **THEN** overall scores and radar dimensions reflect actual mathematical rules

---

## PR 5: UI/UX Toggle & Deductibles

### Functional Requirements
- Client/Técnico toggle MUST control client-side rendering views.
- Técnico mode MUST display confidence badges, technical citations, and detailed Technical Analysis.
- Semicolon-delimited deductibles (e.g., `Seda: 10% min 1SMMLV; Otras: 15%`) MUST be parsed and rendered as structured line items.

### Scenarios
#### Scenario: Técnico view renders full evidence details
- **GIVEN** Técnico mode is active
- **WHEN** the comparison matrix renders
- **THEN** confidence badges and citation links MUST be visible

#### Scenario: Semicolon-delimited deductibles are formatted
- **GIVEN** a deductible string containing a semicolon
- **WHEN** rendered in the cell
- **THEN** the string SHALL be parsed into multiple separate clean list items
