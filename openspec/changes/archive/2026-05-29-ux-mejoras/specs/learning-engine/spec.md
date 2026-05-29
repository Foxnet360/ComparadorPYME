# Spec: Learning Engine (Delta)

## Capability
Sistema de aprendizaje automático basado en retroalimentación humana para mejorar la precisión de mapeo de coberturas.

## User Story
**Como** administrador del sistema
**Quiero** que el sistema aprenda de las correcciones de los usuarios
**Para** mejorar la precisión de extracción automáticamente

## MODIFIED Requirements

### Requirement: Capture user corrections
The system SHALL provide an interface for users to correct system mappings and extractions.

#### Scenario: User corrects coverage mapping
- **WHEN** a user corrects a coverage mapping or deductible in the comparison grid
- **THEN** the system SHALL store this correction in the database
- **AND** include the raw name, insurer name, original system mapping, corrected category, exact text evidence snippet, and calculated source page
- **AND** invalidate affected cache entries immediately for real-time application

#### Scenario: Correction with extended fields
- **WHEN** the frontend sends a correction with rawTextSnippet, pageNumber, or aiJustification
- **THEN** the backend SHALL validate and store these fields in coverage_mappings
- **AND** these fields SHALL be included in future few-shot examples

#### Scenario: Validation of correction payload
- **WHEN** a correction request arrives at POST /api/analysis/correction
- **THEN** the backend SHALL validate the payload using Zod schema
- **AND** reject requests with missing required fields (rawName, userCorrection)
- **AND** return 400 Bad Request with detailed validation errors

#### Scenario: Idempotency of corrections
- **WHEN** the same correction is submitted twice with the same correctionId
- **THEN** the backend SHALL not create a duplicate entry
- **AND** return the existing correction ID

### Requirement: Update thesaurus from corrections
The system SHALL automatically update the thesaurus when users make corrections.

#### Scenario: Thesaurus update
- **WHEN** a user corrects a mapping
- **THEN** the system adds the raw name as a synonym for the corrected category
- **AND** increments a correction count for that mapping
- **AND** uses the corrected mapping with higher priority in future

### Requirement: Retrain embeddings from feedback
The system SHALL periodically update coverage embeddings based on accumulated user corrections.

#### Scenario: Embedding update
- **WHEN** 10+ corrections accumulate for a coverage type
- **THEN** the system generates new embeddings that reflect corrected mappings
- **AND** validates them against held-out test corrections

### Requirement: Track correction effectiveness
The system SHALL measure whether corrections improve future extraction accuracy.

#### Scenario: Measure improvement
- **WHEN** a correction is applied
- **THEN** the system tracks:
  - How many future extractions use the corrected mapping
  - Whether those extractions require further correction
  - Overall correction rate trend over time
- **AND** reports accuracy improvements monthly

### Requirement: Dynamic In-Context Few-Shot Learning
The system SHALL retrieve historical human corrections and inject them as few-shot examples in subsequent LLM classification calls.

#### Scenario: Dynamic examples injected in classifier
- **WHEN** the system runs the semantic classification for a new coverage
- **THEN** the system SHALL execute a vector search for the top 3 most similar past human corrections
- **AND** inject these as dynamic few-shot examples into the Gemini prompt
- **AND** the model SHALL prioritize these historical human criteria for classification

#### Scenario: Few-shot with extended fields
- **WHEN** few-shot examples include rawTextSnippet and pageNumber
- **THEN** the prompt SHALL include this evidence for context
- **AND** the model SHALL use this information to improve classification accuracy

## Dependencies
- Supabase (tabla coverage_mappings)
- Embedding service
- Redis cache
