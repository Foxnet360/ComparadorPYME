# Spec: Rediseño UX/GUI Inicial y Unificación Terminológica

## Requirement: Panel de Control de Alta Usabilidad
The application MUST provide a structured Technical Dashboard for insurance analysts with KPI metrics and filtering capabilities.

### Scenario: Viewing Technical Dashboard KPIs and Filtered Comparisons
- **GIVEN** the analyst is on the main Dashboard ("Panel de Control")
- **WHEN** the dashboard renders
- **THEN** it MUST display summary KPI cards (Total Comparaciones, Conversión %, Prima Total, Prospectos Activos)
- **AND** it MUST provide filters by Insurer, Customer Name, Date Range, and Domain (8 domains)
- **AND** it MUST display comparisons in an organized table with quick actions (Ver Informe, Exportar Excel, Eliminar).

## Requirement: Nomenclatura Unificada "Comparación"
The application MUST use the term "Comparación" consistently across all titles, buttons, navigation items, and progress indicators.

### Scenario: Navigating to New Comparison Flow
- **GIVEN** the user clicks "Nueva Comparación" from the navigation bar
- **WHEN** the new comparison view opens
- **THEN** the view header MUST state "Nueva Comparación de Seguros" (not "Nueva Auditoría")
- **AND** all labels throughout the flow MUST refer to "Comparación" and "Clausulados Comparados".

## Requirement: Soporte Completo de 8 Ramos de Seguros
The application MUST allow analysts to select from 8 insurance product lines (domains) in the comparison creation flow.

### Scenario: Selecting Domain for New Comparison
- **GIVEN** the analyst is creating a new comparison
- **WHEN** opening the domain / ramo selection input
- **THEN** the options MUST include:
  1. PYME Multirriesgo
  2. Todo Riesgo Daños Materiales
  3. Responsabilidad Civil General
  4. Sustracción y Hurto
  5. Transporte de Mercancías
  6. Manejo e Infidelidad de Empleados
  7. Equipo Electrónico
  8. Rotura de Maquinaria.

## Requirement: Unificación de Selección de Cliente y Carga de Clausulados
The application MUST merge redundant client inputs into a single intuitive selector and streamline clause document upload.

### Scenario: Selecting or Creating Client
- **GIVEN** the analyst is filling the new comparison form
- **WHEN** interacting with the client selection area
- **THEN** it MUST present a single unified autocomplete input with inline "Crear nuevo cliente" functionality.

## Requirement: Pantalla de Carga Transparente e Informativa
The progress screen during comparison processing MUST describe real technical pipeline stages and provide helpful tool information.

### Scenario: Waiting for Comparison Processing
- **GIVEN** a comparison is submitted for processing
- **WHEN** the loading progress screen is visible
- **THEN** it MUST title the process "Comparando Clausulados y Cotizaciones..."
- **AND** it MUST show progress through real technical stages (OCR parsing, Gemini 3.5 ontology matching, deductible matrix reconciliation, risk scoring)
- **AND** it MUST display an informative feature carousel explaining system capabilities.
