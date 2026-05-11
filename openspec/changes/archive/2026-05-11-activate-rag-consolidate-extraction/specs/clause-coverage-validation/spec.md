## MODIFIED Requirements

### Requirement: Validate all coverages in a quote against clause documents
The system SHALL validate coverage existence bidirectionally using the unified chunks table.

#### Scenario: Validación de coberturas presentes
- **WHEN** se valida una cotización contra clausulado
- **THEN** el sistema busca coberturas en tabla `chunks` (no `clause_chunks`)
- **AND** filtra por `document_type IN ('CLAUSULADO_GENERAL', 'CLAUSULADO_PARTICULAR')`
- **AND** encuentra coberturas verificadas, fantasma y omitidas

#### Scenario: Sin clausulado disponible
- **WHEN** no hay clausulado para la aseguradora en `chunks`
- **THEN** el sistema reporta que no hay clausulado
- **AND** aplica penalización de score
- **AND** sugiere subir clausulado
