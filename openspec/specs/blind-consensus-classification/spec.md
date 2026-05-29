# Spec: Blind Consensus Classification

## Capability
Sistema de consenso ciego entre dos agentes de IA (Taxónomo y Crítico) para normalizar coberturas extraídas con alta certeza.

## User Story
**Como** suscriptor de seguros
**Quiero** que el sistema valide las clasificaciones de coberturas con doble verificación
**Para** reducir errores de mapeo ontológico y detectar discrepancias

## Requirements

### Requirement: Isolated Dual-Agent Consensus Classification
The system SHALL run a blind consensus mapping between two stateless and isolated AI agents (Taxonomist and Critic) to normalise extracted coverages.

#### Scenario: Successful consensus mapping
- **WHEN** the system has an extracted coverage name "Daños por humo"
- **AND** the Taxonomist Agent proposes the canonical category "daños_materiales"
- **AND** the Critic Agent, running in an isolated session, approves this classification
- **THEN** the system SHALL assign the category "daños_materiales" with high confidence (95%+)
- **AND** approve the mapping automatically without human intervention

#### Scenario: Discrepant consensus mapping triggers human alert
- **WHEN** the Taxonomist Agent proposes a category
- **AND** the Critic Agent, running in an isolated session, disagrees with this classification and suggests an alternative
- **THEN** the system SHALL set the mapping confidence to 50%
- **AND** mark the mapping with a status of pending human verification (`needs_human_review = true`)
- **AND** generate an interactive inline alert in the UI matrix
