## ADDED Requirements

### Requirement: Expand queries with thesaurus synonyms
The system SHALL automatically expand RAG queries using the thesaurus to include synonyms and related terms.

#### Scenario: Expand deductible query
- **WHEN** a user searches for "deducible incendio"
- **THEN** the system expands to:
  - "deducible incendio"
  - "franquicia amparo básico"
  - "participación daño material"
  - "prorrata fuego"
- **AND" searches for all variants simultaneously

### Requirement: Include coverage-related terms
The system SHALL expand queries with related coverage terms from the ontology.

#### Scenario: Expand with related terms
- **WHEN** searching for "terremoto deducible"
- **THEN** the system also searches for:
  - "sismo franquicia"
  - "catastrofes participación"
  - "erupción volcánica deducible"
- **AND" combines results from all variants

### Requirement: Support multi-language query expansion
The system SHALL handle Spanish variants and regional terminology used by different insurers.

#### Scenario: Handle regional terms
- **WHEN** searching for "hurto"
- **THEN** the system also searches for:
  - "sustracción"
  - "robo"
  - "asalto"
  - "mérchandise theft" (if applicable)

---

## Delta from change: arquitectura-fluida-comparador-seguros

## ADDED Requirements

### Requirement: Expand queries with thesaurus synonyms
The system SHALL automatically expand RAG queries using the thesaurus to include synonyms and related terms.

#### Scenario: Expand deductible query
- **WHEN** a user searches for "deducible incendio"
- **THEN** the system expands to:
  - "deducible incendio"
  - "franquicia amparo básico"
  - "participación daño material"
  - "prorrata fuego"
- **AND" searches for all variants simultaneously

### Requirement: Include coverage-related terms
The system SHALL expand queries with related coverage terms from the ontology.

#### Scenario: Expand with related terms
- **WHEN** searching for "terremoto deducible"
- **THEN** the system also searches for:
  - "sismo franquicia"
  - "catastrofes participación"
  - "erupción volcánica deducible"
- **AND" combines results from all variants

### Requirement: Support multi-language query expansion
The system SHALL handle Spanish variants and regional terminology used by different insurers.

#### Scenario: Handle regional terms
- **WHEN** searching for "hurto"
- **THEN** the system also searches for:
  - "sustracción"
  - "robo"
  - "asalto"
  - "mérchandise theft" (if applicable)
