# Template Registry

The Template Registry is the central catalog of insurer-specific PDF layouts.
Each entry describes how to recognize a quote, what schema the extracted data
must follow, and where the relevant coverage/deductible tables are located on
the page.

## Quick start: adding a new insurer template

1. Create a JSON object that conforms to `TemplateRegistryEntry` (see schema
   below).
2. Add it to `data/domains/{domain}/template-seeds.json` or push it through the
   admin API.
3. Restart the service (seeds are loaded on startup) or call
   `POST /api/templates/registry/:templateId/refresh-cache`.
4. Send a test quote and verify in the logs that `template_match` is emitted
   with the expected `templateId` and `confidence`.

## Template entry schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `templateId` | `string` | yes | Stable identifier, e.g. `bbva-pyme-v1`. |
| `insurer` | `string` | yes | Insurer short name, e.g. `BBVA`. |
| `displayName` | `string` | yes | Human readable label. |
| `version` | `number` | yes | Increment when the schema or fingerprints change. |
| `fingerprints` | `object` | yes | Recognition rules (see below). |
| `schema` | `JSON Schema` | yes | Validation schema for LLM-extracted payloads. |
| `extractionHints` | `object` | yes | Page/column hints for the layout parser. |
| `promptAddon` | `string` | no | Extra Spanish instructions appended to the template prompt. |

### Fingerprints

```json
{
  "textMarkers": ["BBVA SEGUROS", "COBERTURAS / DEDUCIBLE"],
  "layoutMarkers": [
    {
      "page": 1,
      "region": "top-right",
      "textRegex": "COT-[0-9]{4}-[0-9]+"
    }
  ],
  "minConfidence": 90
}
```

- `textMarkers`: phrases that must appear in the extracted native PDF text.
  Each matched phrase contributes to a percentage score.
- `layoutMarkers`: positional regular expressions evaluated against individual
  `pdfjs` text items. Use them to boost confidence when a marker only appears
  in a known region (header, footer, left/right margin, center).
  - `region` accepts hyphen-separated parts of `top`, `bottom`, `left`,
    `right`, `center`.
- `minConfidence`: threshold (0-100) the combined score must exceed before the
  template is considered a match.

### Extraction hints

```json
{
  "coverageTablePage": 1,
  "deductibleColumnIndex": 2,
  "premiumColumnIndex": 3
}
```

These hints are passed to the layout-aware prompt builder so the LLM knows
which reconstructed table and column contains each piece of information.

### JSON schema

The `schema` field is a standard JSON Schema object. The LLM output is
validated against it after extraction. If validation fails, the pipeline logs
`schema_validation_failed` and falls back to the generic prompt. A typical
schema requires an array of coverages with `rawName`, `insuredAmount`,
`deductible`, and `premium`.

## Admin API endpoints

All endpoints require authentication and an admin/operator role.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/templates/registry?domain=pyme` | List merged templates (DB overrides seeds). |
| `POST` | `/api/templates/registry?domain=pyme` | Create or update a template. |
| `GET` | `/api/templates/registry/:templateId?domain=pyme` | Get a single template. |
| `DELETE` | `/api/templates/registry/:templateId?domain=pyme` | Deactivate a template. |
| `POST` | `/api/templates/registry/:templateId/refresh-cache?domain=pyme` | Invalidate cache and reload. |
| `POST` | `/api/templates/registry/admin/seed-graph?domain=pyme` | Seed coverage graph edges from the domain bundle. |
| `GET` | `/api/templates/registry/admin/graph/edges?domain=pyme` | List graph edges with optional filters. |
| `POST` | `/api/templates/registry/admin/graph/edges?domain=pyme` | Add a single graph edge. |
| `DELETE` | `/api/templates/registry/admin/graph/edges?domain=pyme` | Delete a graph edge (`from`, `to`, `type` required). |
| `POST` | `/api/templates/registry/admin/graph/corrections?domain=pyme` | Learn from an analyst correction (`raw`, `canonical`). |
| `POST` | `/api/templates/registry/admin/graph/seed-thesaurus?domain=pyme` | Seed alias edges from the thesaurus. |

## Observability

The registry emits the following structured log events:

| Event | Level | Fields |
|-------|-------|--------|
| `template_match` | `info` | `templateId`, `insurer`, `confidence`, `domain` |
| `template_miss` | `info` | `domain`, `inputLength`, `hasPages` |
| `schema_validation_failed` | `warn` | `templateId`, `domain`, `errors` |
| `cache_refresh` | `info` | `domain` |

Counter names follow the pattern `templateRegistry.{event}` with tags for
`domain` and `templateId` when applicable.
