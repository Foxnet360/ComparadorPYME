# Spec: Ontología Activa con Tri-Banda de Confianza y Micro-Intervenciones UI

## Requirements

### Requirement 1: Tri-Banda de Confianza Ontológica
`server/src/services/coverageOntology.ts` MUST:
- Classify every coverage mapping into one of three certainty bands:
  - `trusted`: when `confidence >= 0.85` and not marked as EXCLUSIVE.
  - `ambiguous`: when `0.50 <= confidence < 0.85`.
  - `autonomous`: when `confidence < 0.50` or `groupId === 'EXCLUSIVE'`.
- Set `needsHumanReview = true` exclusively when `certaintyBand === 'ambiguous'`.
- Provide `certaintyBand` in the `CoverageMapping` output interface.

#### Scenario: Cobertura con coincidencia canónica exacta
- **GIVEN** a coverage named "Amparo Básico Incendio"
- **WHEN** evaluated by `coverageOntology.mapCoverage`
- **THEN** it SHALL return `confidence >= 0.90`, `certaintyBand: 'trusted'`, and `needsHumanReview: false`.

#### Scenario: Cobertura con terminología ambigua
- **GIVEN** a coverage named "Gastos de Preservación de Bienes" matching at 68% confidence
- **WHEN** evaluated by `coverageOntology.mapCoverage`
- **THEN** it MUST return `certaintyBand: 'ambiguous'`, `needsHumanReview: true`, and provide an AI explanation in `justification`.

#### Scenario: Cobertura atípica / exclusiva
- **GIVEN** a highly specific coverage with confidence below 50%
- **WHEN** evaluated by `coverageOntology.mapCoverage`
- **THEN** it MUST return `certaintyBand: 'autonomous'`, `groups: []`, and avoid artificial forced mapping.

---

### Requirement 2: Endpoint de Desambiguación Activa
The `POST /api/analysis/disambiguate-coverage` endpoint MUST:
- Accept `rawName`, `insurerName`, `canonicalGroupId`, and `action` ('confirm' | 'reassign' | 'keep_autonomous').
- When `action === 'confirm'` or `'reassign'`:
  - Invoke `learningEngine.saveCorrection` with `correctionType: 'coverage_mapping'`.
  - Update `coverage_mappings` in Supabase setting `needs_human_review = false`, `confidence = 0.98`, and `user_corrected = true`.
- When `action === 'keep_autonomous'`:
  - Update `coverage_mappings` setting `needs_human_review = false` and `canonical_name = 'EXCLUSIVE'`.
- Return HTTP 200 with `{ success: true, updatedGroupId: string }`.

---

### Requirement 3: Componente de Desambiguación en UI
`components/report/DisambiguationCard.tsx` MUST:
- Identify items requiring validation (`needsHumanReview === true` or confidence in 50%-84%).
- Display at most 3 cards simultaneously to prevent cognitive fatigue.
- Allow 1-click confirmation or dismissal.
- Update internal state optimistically upon action.
