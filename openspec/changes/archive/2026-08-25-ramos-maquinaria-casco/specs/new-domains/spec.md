# Spec: Ramos Maquinaria y Equipo + Casco Embarcación

## Requirement: Dominio equipo_maquinaria
The application MUST support the `equipo_maquinaria` domain across taxonomy, thesaurus, analysis engine, and UI.

### Scenario: Selecting equipo_maquinaria domain
- **WHEN** selecting "Maquinaria y Equipo" in the domain selector
- **THEN** the active domain MUST set to `equipo_maquinaria`
- **AND** client registration MUST request machinery replacement value and maintenance parameters.

## Requirement: Dominio casco_embarcacion
The application MUST support the `casco_embarcacion` domain across taxonomy, thesaurus, DIMAR maritime regulatory compliance, and UI.

### Scenario: Selecting casco_embarcacion domain
- **WHEN** selecting "Casco Embarcación" in the domain selector
- **THEN** the active domain MUST set to `casco_embarcacion`
- **AND** client registration MUST request DIMAR registration number, hull material, vessel dimensions, and GRT tonnage.
