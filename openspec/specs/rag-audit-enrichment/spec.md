## ADDED Requirements

### Requirement: Enriquecimiento RAG de alertas
El sistema DEBE buscar automáticamente en clausulados indexados para fundamentar cada alerta generada durante el análisis.

#### Scenario: Alerta con clausulado disponible
- **WHEN** una alerta CRITICAL indica "Deducible Terremoto sobre Valor Asegurado 15%"
- **THEN** el sistema busca en Supabase chunks relacionados a "deducible terremoto"
- **AND** encuentra el chunk: "Art. 5.2: El deducible será del 15% sobre el valor total asegurado"
- **AND** agrega la cita como evidence con similitud score

#### Scenario: Alerta sin clausulado disponible
- **WHEN** una alerta no tiene clausulado indexado para esa aseguradora
- **THEN** el sistema marca la alerta como "Análisis inferido de cotización"
- **AND** proporciona contexto técnico basado en datos extraídos

### Requirement: Evidence Cards
El sistema DEBE mostrar tarjetas de evidencia con la cita del clausulado.

#### Scenario: Mostrar evidence
- **WHEN** el usuario hace clic en "Enriquecer" o expande una alerta
- **THEN** se muestra el texto del clausulado
- **AND** se indica la página/sección
- **AND** se muestra el score de similitud

### Requirement: Botón condicional
El botón "Enriquecer" solo debe estar disponible cuando hay clausulados.

#### Scenario: Clausulados disponibles
- **WHEN** existe al menos un clausulado indexado para alguna aseguradora del reporte
- **THEN** el botón "Enriquecer con Clausulados" está activo

#### Scenario: Sin clausulados
- **WHEN** no hay clausulados indexados
- **THEN** se muestra mensaje: "No hay clausulados disponibles. Análisis basado en datos de cotización."
