## MODIFIED Requirements

### FR-1: Validación de existencia (Quote → Clause)

El sistema DEBE verificar que cada cobertura presente en la cotización exista en el clausulado de la aseguradora. Para esto, el sistema DEBE normalizar previamente el nombre de la aseguradora de la cotización usando el servicio de normalización canónico antes de realizar cualquier consulta en la base de datos de clausulados.

#### Scenario: Cobertura verificada
- **WHEN** una cotización incluye "Incendio (Edificio y Contenidos)" para la aseguradora "SBS SEGUROS COLOMBIA S.A."
- **AND** el sistema normaliza el nombre a "SBS" para consultar el clausulado indexado
- **AND** el clausulado de "SBS" menciona esta cobertura
- **THEN** se marca como ✅ **Verificada**

#### Scenario: Cobertura fantasma
- **WHEN** una cotización incluye "Rotura de Maquinaria" para la aseguradora "SBS SEGUROS COLOMBIA S.A."
- **AND** el sistema normaliza el nombre a "SBS" para consultar el clausulado indexado
- **AND** el clausulado de "SBS" NO contempla esta cobertura
- **THEN** se genera alerta **CRITICAL**: "Cobertura ofrecida no contemplada en clausulado"
- **AND** el score de coverage se reduce en 15 puntos por cobertura fantasma

### FR-3: Penalización en scoring

El sistema DEBE penalizar el score cuando el clausulado no está disponible o cuando se detectan coberturas fantasmas. La disponibilidad del clausulado se debe evaluar utilizando el nombre normalizado de la aseguradora.

#### Scenario: Sin clausulado disponible
- **WHEN** no hay clausulado indexado para la aseguradora con nombre normalizado (ej. "SBS")
- **THEN** el score base de coverage se reduce de 50 a 30
- **AND** se muestra advertencia: "Análisis sin validación de clausulado"

#### Scenario: Con coberturas fantasmas
- **WHEN** se detectan 2 coberturas fantasmas
- **THEN** el score de coverage se reduce en 30 puntos (2 × 15)
- **AND** el score mínimo es 0
