# Proposal: Tests and Manifest Follow-ups

## Intent

Address three deferred follow-up items from the archived change `tesauro-multidominio-clausulados-reconcile`. These items improve observability, test coverage, and data integrity around domain taxonomy bundles and insurer name normalization. No production behavior changes.

## Scope

### In Scope
- **bundle.json manifest**: Create `data/domains/pyme/bundle.json` referencing taxonomy.json, ontology.json, and thesaurus.json. Add Zod schema + loader helper in `domainBundleSchema.ts`.
- **insurerNameNormalizer unit tests**: Cover `normalize()`, `getUnmappedTelemetry()`, and `clearTelemetry()` in a dedicated test file.
- **Bundle isolation integration test**: Validate that concurrent quote processing for different domains does not leak taxonomy data. Uses `semanticMatcher.clearCache()` to verify per-domain cache isolation.

### Out of Scope
- Lazy `database.ts` initialization (separate change — high touch area, ~20+ imports).
- Review queue E2E test (separate change — spans normalizer → DB → API).

## Capabilities

### New Capabilities
None — pure test coverage and data-structure convenience.

### Modified Capabilities
None — no spec-level requirement changes.

## Approach

1. **Manifest**: Write `bundle.json` with `version`, `domain`, and `files` keys. Add `BundleManifestSchema` to `domainBundleSchema.ts` and a `loadDomainBundleManifest()` helper to `domainBundleLoader.ts`.
2. **Normalizer tests**: Create `server/src/services/__tests__/insurerNameNormalizer.test.ts` with cases for direct mapping, case-insensitive match, alias inclusion, unmapped telemetry accumulation, and `clearTelemetry()`.
3. **Isolation test**: Extend `domainThreading.test.ts` with a test that calls `semanticMatcher.clearCache()`, loads categories for two domains in sequence, and asserts caches are independent.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `data/domains/pyme/bundle.json` | New | Unified manifest for PYME domain bundle |
| `server/src/schemas/domainBundleSchema.ts` | Modified | Add `BundleManifestSchema` + validation helper |
| `server/src/services/domainBundleLoader.ts` | Modified | Add `loadDomainBundleManifest()` helper |
| `server/src/services/__tests__/insurerNameNormalizer.test.ts` | New | Unit tests for `insurerNameNormalizer` |
| `server/src/services/__tests__/domainThreading.test.ts` | Modified | Add cache-isolation scenario |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Manifest schema mismatch with future bundle additions | Low | Version field in manifest; schema validation catches drift |
| Test flakes in isolation test from shared module state | Low | `clearCache()` before each assertion; no async race conditions |

## Rollback Plan

- Remove `bundle.json` and revert schema/loader additions — existing services read individual files directly, so no runtime impact.
- Delete new test files — they do not affect production code.

## Dependencies

- Existing `domain-taxonomy-bundles` spec (bundles already in place).
- Existing `domainBundleSchema.ts` (Zod schemas already defined).

## Success Criteria

- [ ] `data/domains/pyme/bundle.json` exists and passes schema validation.
- [ ] `loadDomainBundleManifest('pyme')` returns correct file references.
- [ ] `insurerNameNormalizer.test.ts` covers `normalize`, `getUnmappedTelemetry`, and `clearTelemetry` with all cases passing.
- [ ] `domainThreading.test.ts` isolation test passes and proves per-domain cache separation.
- [ ] Full Vitest suite passes (`npm test`).
