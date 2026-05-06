## ADDED Requirements

### Requirement: Integración en flujo principal de análisis
El sistema DEBE incluir la opinión legal en la respuesta del endpoint `/api/analyze` cuando se solicite análisis avanzado.

#### Scenario: Opinión legal incluida en respuesta
- **WHEN** el sistema completa el análisis de una cotización
- **AND** el cliente tiene un perfil configurado
- **AND** se solicita análisis avanzado
- **THEN** la respuesta JSON incluye el campo `legalOpinion` con opiniones por cobertura crítica

#### Scenario: Puntos de negociación priorizados
- **WHEN** se generan opiniones legales
- **THEN** se identifican puntos de negociación
- **AND** se priorizan por nivel (HIGH/MEDIUM/LOW)
- **AND** se incluyen en la respuesta de `/api/analyze`

### Requirement: Visualización de asesoría legal
El sistema DEBE mostrar opiniones legales y puntos de negociación en la pestaña de análisis avanzado.

#### Scenario: Tarjeta de opinión legal visible
- **WHEN** el usuario accede a la pestaña "Análisis Avanzado"
- **AND** existen datos de `legalOpinion`
- **THEN** se muestra `LegalOpinionCard` con:
  - Escenario de riesgo
  - Interpretación del clausulado
  - Recomendación legal
  - Citas del clausulado

#### Scenario: Lista de puntos de negociación
- **WHEN** existen puntos de negociación
- **THEN** se muestra `NegotiationPointsList` ordenado por prioridad
- **AND** cada punto incluye justificación y resultado esperado

## MODIFIED Requirements

### Requirement: Generación de opinión legal
El sistema DEBE generar una opinión legal para cada cobertura crítica, considerando cotización, clausulado, y perfil del cliente.

#### Scenario: Opinión sobre cobertura suficiente
- **WHEN** el cliente es manufacturero con 150 empleados
- **AND** la cotización ofrece RC por $500M
- **THEN** la opinión legal indica:
  - "Para un manufacturero de alimentos con 150 empleados, el límite de RC de $500M puede ser insuficiente."
- **AND** se incluye punto de negociación: "Solicitar aumento de límite RC a $1.000M"
- **AND** todo se incluye en la respuesta de `/api/analyze`

#### Scenario: Opinión sobre exclusión problemática
- **WHEN** el clausulado excluye "falla de proveedor único"
- **AND** el cliente depende de un solo proveedor
- **THEN** la opinión legal indica:
  - "Esta exclusión representa un riesgo crítico dado que el cliente depende de un único proveedor."
- **AND** se incluye punto de negociación: "Negociar eliminación de exclusión o contratar cobertura de cadena de suministro"
