# Coverage Semantic Graph

The Coverage Semantic Graph stores probabilistic relationships between raw
insurer terms, aliases, canonical categories, composite coverage rules, and
deductible applicability. It is the learning layer that lets the extraction
pipeline improve as analysts validate or correct mappings.

## Node and edge semantics

### Node prefixes

Node identifiers use prefixes so the query engine can distinguish the role of
each node without extra metadata.

| Prefix | Meaning | Example |
|--------|---------|---------|
| (no prefix) | Canonical category id | `incendio` |
| `raw:` | Raw term extracted from a quote | `raw:daño material` |
| `alias:` | Insurer-specific alias | `alias:dmg` |
| `cat:` | Explicit canonical category prefix | `cat:incendio` |
| `composite:` | Bundle of coverages sold as one | `composite:amparo-basico` |
| `deductible:` | Deductible rule node | `deductible:10pct-min-5smmlv` |

### Edge types

| Edge type | Direction | Semantics |
|-----------|-----------|-----------|
| `maps_to` | raw/alias → canonical/composite | Direct mapping with a base weight. |
| `alias_of` | alias → canonical | Synonym or insurer abbreviation. |
| `alias` | alias → canonical | Deprecated alias kept for backward compatibility. |
| `decomposes_to` | composite → canonical | A bundled coverage breaks into these canonical components. |
| `deductible_for` | deductible text → canonical | This deductible text applies to this coverage. |
| `applies_to` | deductible text → canonical | Same as `deductible_for` but used for line-level applicability. |
| `excludes` | canonical → canonical | One coverage explicitly excludes another. |
| `learned` | raw/alias → canonical | Mapping created or reinforced by an analyst correction. |

## Query and propagation

### How a query is resolved

When `coverageGraphService.query(rawName)` is called, the engine executes the
following steps:

1. **Cache lookup**: return immediately if a previous result is cached.
2. **Direct edges**: collect `maps_to`, `alias_of`, `alias`, and `learned`
   edges whose `from_node` matches the normalized raw term.
3. **Indirect paths**: follow one `alias_of`/`alias` hop and then a direct
   mapping edge (depth 2). Confidence is the product of the two edge weights.
4. **Composite decomposition**: if the term maps to a `composite:` node,
   follow `decomposes_to` edges and add each component as a separate mapping.
5. **Ranking**: mappings are sorted by confidence and truncated to `topK`
   (default 5).

Confidence is computed as:

```
base = min(0.99, edge.weight + 0.02 * correction_count)
confidence = base * 0.95 + embedding_similarity * 0.05
```

The small embedding blend helps separate terms that are spelled similarly but
mean different things.

### Ambiguous mappings

A raw term is considered ambiguous when the top mapping confidence is below
the pipeline threshold or when two mappings have similar scores. In that case:

- The pipeline keeps the best candidate but marks the coverage for review.
- The normalizer may fall back to the thesaurus or LLM consensus layer.
- If the graph returns a composite decomposition, each component is emitted
  as a separate canonical coverage so the comparison engine can reason about
  them individually.

## Learning from analyst corrections

Analyst corrections flow through `coverageGraphService.learnCorrection(raw,
canonical, insurer?, domain?)`:

1. Normalize the raw term.
2. Look for an existing `learned` edge between the raw term and canonical id.
3. Increment `correction_count` and recompute the weight using
   `0.7 + 0.02 * correction_count`, capped at `0.99`.
4. Upsert the edge and invalidate the query cache.

The admin API exposes this through
`POST /api/templates/registry/admin/graph/corrections`.

The periodic `propagate()` job recalculates weights for all `learned` edges to
keep the correction boost consistent across restarts.

## Observability

The graph service emits the following structured log events:

| Event | Level | Meaning |
|-------|-------|---------|
| `graph_hit` | `info` | Query resolved from cache. |
| `graph_db_hit` | `info` | Query resolved from the database. |
| `graph_cold_start_miss` | `info` | No mappings found for a raw term. |
| `graph_learned` | `info` | A new analyst correction was stored. |
| `graph_query_failed` | `error` | The database query failed. |

Counter names follow the pattern `coverageGraph.{event}` with tags for
`source`, `domain`, and `insurer` when applicable.
