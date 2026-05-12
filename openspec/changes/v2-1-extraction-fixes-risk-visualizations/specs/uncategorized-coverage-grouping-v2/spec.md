# Spec: Uncategorized Coverage Grouping V2

## Capability
Preservación, categorización semántica, y visualización agrupada de coberturas que no mapean a las 14 categorías canónicas PYME.

## User Story
**Como** usuario del comparador
**Quiero** ver todas las coberturas adicionales que ofrecen las aseguradoras
**Para** comparar valor agregado y servicios complementarios

## ADDED Requirements

### Requirement: Preservar coberturas no canónicas
El system SHALL preservar todas las coberturas extraídas que no mapean a las 14 categorías canónicas, en lugar de descartarlas.

#### Scenario: Cobertura sin match canónico
- **WHEN** una cobertura extraída no hace match a ninguna de las 14 categorías
- **THEN** el system SHALL agregarla a array `uncategorizedCoverages`
- **AND** SHALL NOT descartarla silenciosamente

#### Scenario: Cobertura con valor nulo
- **WHEN** una cobertura no canónica tiene insuredAmount = 0 o null
- **AND** no tiene prima asociada
- **THEN** el system MAY omitirla del resultado

### Requirement: Categorización semántica por tipo de negocio
El system SHALL agrupar coberturas no canónicas en categorías de negocio usando similitud semántica.

#### Scenario: Agrupar asistencias
- **WHEN** hay coberturas como "Asistencia Domiciliaria", "Asistencia Informática", "Servicio de Grua"
- **THEN** el system SHALL agruparlas bajo "Asistencias y Servicios"

#### Scenario: Agrupar amparos adicionales
- **WHEN** hay coberturas como "Seguro Hotelero", "Cobertura para Eventos", "Equipos Especiales"
- **THEN** el system SHALL agruparlas bajo "Amparos Adicionales"

#### Scenario: Agrupar servicios profesionales
- **WHEN** hay coberturas como "Asesoría Legal", "Asesoría Tributaria", "Consultoría"
- **THEN** el system SHALL agruparlas bajo "Servicios Profesionales"

#### Scenario: Otros
- **WHEN** una cobertura no encaja en ningún grupo conocido
- **THEN** el system SHALL colocarla en "Otros Servicios"

### Requirement: Asignar metadatos de matching
El system SHALL asignar categoryId, matchConfidence, y matchMethod a TODAS las coberturas (canónicas y no canónicas).

#### Scenario: Cobertura canónica con match
- **WHEN** una cobertura mapea a categoría canónica
- **THEN** categoryId SHALL ser el ID de la categoría
- **AND** matchConfidence SHALL reflejar la confianza del match

#### Scenario: Cobertura no canónica con grupo
- **WHEN** una cobertura se asigna a grupo semántico
- **THEN** categoryId SHALL ser el ID del grupo (ej: "asistencias", "amparos-adicionales")
- **AND** matchConfidence SHALL reflejar similitud del embedding

### Requirement: Visualización agrupada en frontend
El frontend SHALL mostrar coberturas no canónicas agrupadas por tipo en sección expandible.

#### Scenario: Sección expandible
- **WHEN** hay coberturas no canónicas
- **THEN** se muestra sección "Coberturas Adicionales" con acordeón por grupo
- **AND** cada grupo muestra coberturas con valor, deducible, y prima

#### Scenario: Comparación entre aseguradoras
- **WHEN** el usuario ve coberturas adicionales
- **THEN** se muestra qué aseguradoras ofrecen cada cobertura adicional
- **AND** se resaltan diferencias y coberturas exclusivas

#### Scenario: Sin coberturas adicionales
- **WHEN** no hay coberturas no canónicas
- **THEN** la sección "Coberturas Adicionales" no se muestra

## Dependencies
- `multimodal-pdf-extraction` para datos crudos
- `semantic-matching` para embeddings y similitud
- `coverage-post-normalization` para metadatos
