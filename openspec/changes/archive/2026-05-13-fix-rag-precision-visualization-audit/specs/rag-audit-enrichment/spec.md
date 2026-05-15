## MODIFIED Requirements

### Requirement: Enriquecimiento RAG de alertas
El sistema DEBE buscar automáticamente en clausulados indexados para fundamentar cada alerta generada durante el análisis.

#### Scenario: Alerta con clausulado disponible
- **WHEN** una alerta CRITICAL indica "Deducible Terremoto sobre Valor Asegurado 15%"
- **THEN** el sistema busca en Supabase chunks relacionados a "deducible terremoto"
- **AND** encuentra el chunk: "Art. 5.2: El deducible será del 15% sobre el valor total asegurado"
- **AND** agrega la cita como evidence con similitud score
- **AND** incluye contexto de negocio: "Este deducible está por encima del promedio de mercado (10%). Oportunidad de negociación."

#### Scenario: Alerta sin clausulado disponible
- **WHEN** una alerta no tiene clausulado indexado para esa aseguradora
- **THEN** el sistema marca la alerta como "Análisis inferido de cotización"
- **AND** proporciona contexto técnico basado en datos extraídos
- **AND** proporciona contexto de negocio cuando sea posible (benchmarks del mercado)

### Requirement: Evidence Cards
El sistema DEBE mostrar tarjetas de evidencia con la cita del clausulado.

#### Scenario: Mostrar evidence
- **WHEN** el usuario hace clic en "Enriquecer" o expande una alerta
- **THEN** se muestra el texto del clausulado
- **AND** se indica la página/sección
- **AND** se muestra el score de similitud
- **AND** se muestra contexto de negocio relevante

### Requirement: Botón condicional
El botón "Enriquecer" solo debe estar disponible cuando hay clausulados.

#### Scenario: Clausulados disponibles
- **WHEN** existe al menos un clausulado indexado para alguna aseguradora del reporte
- **THEN** el botón "Enriquecer con Clausulados" está activo

#### Scenario: Sin clausulados
- **WHEN** no hay clausulados indexados
- **THEN** se muestra mensaje: "No hay clausulados disponibles. Análisis basado en datos de cotización."

## ADDED Requirements

### Requirement: Competitive analysis in audit
El sistema DEBE incluir análisis comparativo entre aseguradoras en la sección de auditoría.

#### Scenario: Deductible comparison
- **WHEN** el usuario ve la auditoría de una cotización
- **THEN** se muestra una comparación de deducibles por cobertura vs otras aseguradoras
- **AND** se destaca si la aseguradora tiene el mejor/peor deducible

#### Scenario: Coverage comparison
- **WHEN** el usuario ve la auditoría
- **THEN** se muestra análisis de "Coberturas exclusivas" que solo esta aseguradora ofrece
- **AND** se muestra análisis de "Coberturas faltantes" vs la competencia

### Requirement: Negotiation points
El sistema DEBE identificar puntos de negociación específicos para cada cotización.

#### Scenario: Negotiable deductible
- **WHEN** un deducible es 50% más alto que el promedio del mercado
- **THEN** la auditoría muestra: "Punto de negociación: Solicitar reducción de deducible"

#### Scenario: Missing high-impact coverage
- **WHEN** una cobertura crítica (Incendio, RC, Hurto) está ausente
- **THEN** la auditoría muestra: "Oportunidad: Negociar inclusión de [cobertura]"

### Requirement: Client profile recommendations
El sistema DEBE personalizar recomendaciones según el perfil del cliente.

#### Scenario: Profile-aware priorities
- **WHEN** el perfil del cliente indica "restaurante"
- **THEN** la auditoría prioriza alertas relacionadas con RC, Incendio, y Equipo Eléctrico
- **AND** proporciona recomendaciones específicas para el sector
