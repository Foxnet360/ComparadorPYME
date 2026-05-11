## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir el análisis contextual de exclusiones en la respuesta del endpoint `/api/analyze` cuando exista un perfil de cliente.

#### Scenario: Exclusiones contextualizadas incluidas en respuesta
- **WHEN** el sistema completa el análisis de una cotización
- **AND** existe un `clientProfile` asociado al análisis
- **AND** la cotización tiene exclusiones
- **THEN** la respuesta JSON incluye el campo `contextualRisk` con exclusiones contextualizadas

#### Scenario: Análisis sin perfil de cliente
- **WHEN** el sistema analiza una cotización
- **AND** no existe perfil de cliente
- **THEN** el campo `contextualRisk` es null o no está presente
- **AND** el análisis principal funciona normalmente

### Requirement: Visualización de riesgos contextualizados
El sistema DEBE mostrar tarjetas de riesgo contextualizado para cada exclusión relevante.

#### Scenario: Tarjeta de riesgo crítico
- **WHEN** una exclusión es CRITICAL para el perfil del cliente
- **THEN** se muestra tarjeta destacada con color rojo
- **AND** incluye explicación del riesgo específico
- **AND** sugiere mitigaciones (contratar cobertura adicional, verificar sistema, etc.)

#### Scenario: Tarjeta de riesgo moderado
- **WHEN** una exclusión es HIGH o MEDIUM para el perfil
- **THEN** se muestra tarjeta con color correspondiente
- **AND** incluye explicación contextualizada

## MODIFIED Requirements

### Requirement: Contextualización de exclusiones por perfil
El sistema DEBE contextualizar el nivel de riesgo de las exclusiones según el perfil del cliente.

#### Scenario: Exclusión de inundación en zona costera
- **WHEN** la cotización excluye inundación
- **AND** el cliente está en zona costera
- **THEN** el riesgo contextualizado es CRITICAL
- **AND** se sugiere contratar cobertura adicional por inundación
- **AND** se incluye en la respuesta de `/api/analyze`

#### Scenario: Exclusión de terremoto en zona no sísmica
- **WHEN** la cotización excluye terremoto
- **AND** el cliente está en zona urbana de bajo riesgo sísmico
- **THEN** el riesgo contextualizado es LOW
- **AND** se indica que es una exclusión estándar aceptable
