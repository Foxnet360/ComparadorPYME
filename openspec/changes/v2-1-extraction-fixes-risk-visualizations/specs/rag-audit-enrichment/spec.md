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

## MODIFIED Requirements

### Requirement: Enriquecimiento automático al cargar auditoría
**Reason**: Users forget to click the manual button, missing valuable analysis context

#### Scenario: Auto-enrich on audit tab load
- **WHEN** the user navigates to the "Auditoría de Riesgos" tab
- **AND** clausulados are available for at least one insurer in the analysis
- **THEN** the system SHALL automatically call the enrichment endpoint
- **AND** display a loading indicator: "Enriqueciendo análisis con clausulados..."
- **AND** upon completion, show enriched alerts without requiring user action

#### Scenario: Graceful handling when no clausulados
- **WHEN** the user navigates to the "Auditoría de Riesgos" tab
- **AND** no clausulados are indexed for any insurer
- **THEN** the system SHALL display an informational message
- **AND** the message SHALL read: "Análisis basado en datos de cotización. Suba clausulados para enriquecer el análisis."
- **AND** the message SHALL include a link to the document upload page

#### Scenario: Re-enrichment button
- **WHEN** enrichment has completed automatically
- **THEN** a button "Actualizar con Clausulados" SHALL be available
- **AND** clicking it SHALL re-run enrichment (useful if new clausulados were uploaded)
- **AND** the button SHALL be disabled during enrichment

### Requirement: Asynchronous enrichment with progress
**Reason**: Previous synchronous enrichment blocked the UI

#### Scenario: Async enrichment
- **WHEN** enrichment starts
- **THEN** the system SHALL process alerts asynchronously
- **AND** the user SHALL be able to view non-enriched alerts immediately
- **AND** enriched alerts SHALL appear as they complete

#### Scenario: Progress indicator
- **WHEN** enrichment is in progress
- **THEN** a progress bar SHALL show "Enriqueciendo X de Y alertas"
- **AND** completed alerts SHALL be marked with a check icon
