## ADDED Requirements

### Requirement: Analyze deductibles from quote data
The system SHALL analyze deductible risk directly from quote coverage data without requiring RAG.

#### Scenario: High deductible detection
- **WHEN** a coverage has deductible > 10% or "NO ESPECIFICADO"
- **THEN** the audit SHALL flag it as CRITICAL risk
- **AND** include explanation: "Deducible elevado o no especificado"

#### Scenario: Deductible comparison across insurers
- **WHEN** multiple insurers offer the same coverage
- **THEN** the audit SHALL compare deductibles and highlight the best/worst
- **AND** recommend negotiating with insurers having higher deductibles

#### Scenario: Missing deductible analysis
- **WHEN** a material coverage has no deductible specified
- **THEN** the audit SHALL flag it as WARNING
- **AND** suggest verifying with the insurer

### Requirement: Detect missing canonical coverages
The system SHALL identify which of the 14 canonical coverages are missing from each quote.

#### Scenario: Coverage gap identification
- **WHEN** a quote is missing 3+ canonical coverages
- **THEN** the audit SHALL list missing coverages by name
- **AND** categorize impact as HIGH (critical coverage missing) or MEDIUM

#### Scenario: Compare coverage completeness
- **WHEN** comparing 2+ quotes
- **THEN** the audit SHALL rank insurers by coverage count
- **AND** highlight insurers with significantly fewer coverages

### Requirement: Extract special conditions from quote text
The system SHALL parse quote raw text to identify special conditions and exclusions.

#### Scenario: Special condition detection
- **WHEN** the raw text contains phrases like "Condición especial:", "Nota:", "Sujeto a:"
- **THEN** the audit SHALL extract and list these conditions
- **AND** flag any exclusionary language as WARNING

#### Scenario: Exclusion analysis
- **WHEN** the raw text contains "No cubre", "Excluye", "Exclusión"
- **THEN** the audit SHALL list excluded items per coverage
- **AND** cross-reference with coverage names

### Requirement: Generate audit without RAG dependency
The system SHALL generate a complete audit analysis using only quote data, regardless of RAG availability.

#### Scenario: No clauses indexed
- **WHEN** no clause documents are indexed for any insurer
- **THEN** the audit SHALL still show deductible risks, missing coverages, and special conditions
- **AND** display label: "Análisis basado en datos de cotización"

#### Scenario: Partial RAG availability
- **WHEN** some insurers have clauses indexed and others don't
- **THEN** the audit SHALL show quote-based analysis for all
- **AND** enrich with RAG only for insurers that have indexed clauses
- **AND** clearly label which analysis is RAG-enriched vs quote-based
