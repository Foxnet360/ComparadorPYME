## Delta Spec

### Requirement: Contextualización por perfil de cliente

El sistema DEBE usar el perfil del cliente (no solo la industria genérica) para enriquecer alertas.

#### Scenario: Alerta contextualizada con perfil
- **WHEN** se genera una alerta sobre exclusión de inundación
- **AND** el cliente está en zona costera
- **THEN** el businessContext incluye: "Cliente en zona costera - riesgo CRÍTICO específico"

#### Scenario: Alerta con perfil incompleto
- **WHEN** no hay perfil detallado del cliente
- **THEN** se usa contexto genérico por industria (comportamiento actual)
- **AND** se muestra nota: "Complete el perfil del cliente para análisis personalizado"

### Requirement: Evidence mejorada

Las evidence cards DEBEN incluir información contextualizada.

#### Scenario: Evidence con contexto
- **WHEN** se muestra evidencia de clausulado
- **THEN** se incluye:
  - Texto del clausulado (existente)
  - Score de similitud (existente)
  - **NUEVO**: Relevancia para este cliente específico
  - **NUEVO**: Impacto si se mantiene tal cual
