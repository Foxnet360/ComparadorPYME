# Spec: Multi-Template Extraction

## ADDED Requirements

### Requirement: Layout Pre-Processing and Spatial Table Reconstruction
The extraction system SHALL analyze document layout and bounding box coordinates prior to prompt construction to reconstruct table structures and preserve spatial relationships between coverages, insured amounts, and deductibles.

#### Scenario: Successful spatial reconstruction of double-table layout
- **WHEN** a document with separate coverage and deductible tables (Double Table layout) is processed
- **THEN** the layout analyzer SHALL associate each coverage row with its corresponding deductible section using spatial coordinate alignment.

#### Scenario: Fallback for unstructured text documents
- **WHEN** a document lacks clear table boundaries or bounding box grids
- **THEN** the layout analyzer SHALL route the document through descriptive text parsing without breaking table alignment contracts.

### Requirement: Page Routing and Thematic Chunking
The extraction system SHALL inspect page headings and section markers to isolate high-value pages (quote summary, coverage schedule, deductible terms) and prune irrelevant general condition pages.

#### Scenario: Filtering multi-page PDF documents
- **WHEN** a quote PDF exceeding 10 pages is submitted for analysis
- **THEN** the page router SHALL select only pages containing financial summaries, coverage tables, or deductible schedules, reducing prompt context length.

#### Scenario: Single-page or short document processing
- **WHEN** a quote document contains 3 or fewer pages
- **THEN** the page router SHALL retain all pages without pruning.

### Requirement: Insurer Fingerprinting and Template Registry
The extraction system SHALL detect insurer-specific visual and textual fingerprints and inject targeted few-shot prompt examples matching the identified template.

#### Scenario: Recognized insurer template match
- **WHEN** a PDF matches a registered fingerprint (e.g. Sura, AXA, Mapfre, SBS, Bolívar)
- **THEN** the extraction engine SHALL load the insurer-specific extraction hints and few-shot examples into the LLM prompt.

#### Scenario: Unrecognized template fallback
- **WHEN** a PDF does not match any registered insurer fingerprint
- **THEN** the extraction engine SHALL fall back to the domain's default format-family extraction strategy.

### Requirement: Multi-Stage Cascade Extraction Pipeline
The extraction system SHALL execute a modular 3-stage extraction pipeline (Stage 1: Premium & Policy Details, Stage 2: Raw Coverages, Stage 3: Deductibles & Regulatory Compliance) and merge the outputs into a unified JSON structure.

#### Scenario: Sequential multi-stage execution
- **WHEN** a complex multi-product quote is processed
- **THEN** the pipeline SHALL execute Stage 1, Stage 2, and Stage 3 sequentially, validating and merging intermediate JSON payloads without data loss.

### Requirement: Deterministic Post-Processing and Financial Reconciliation
The extraction system SHALL deterministically validate financial totals (`netPremium + taxes + fees == totalPayable`) and verify that all mandatory domain coverages are assigned explicit deductibles or standard fallback flags.

#### Scenario: Mathematical discrepancy auto-correction
- **WHEN** the extracted `totalPayable` differs from the sum of `netPremium`, `taxes`, and `fees`
- **THEN** the system SHALL execute a targeted re-prompt passing the specific mathematical error for immediate LLM correction.

#### Scenario: Mandatory coverage deductible audit
- **WHEN** a mandatory domain coverage (e.g. Ley 675 Incendio/Terremoto in Copropiedades or Ley 80 Garantía Única in Cumplimiento) lacks a deductible value
- **THEN** the system SHALL assign an explicit fallback ("No aplica" or "Ver clausulado") and flag it for audit.
