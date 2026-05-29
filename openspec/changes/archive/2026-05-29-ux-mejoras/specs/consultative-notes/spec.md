# Spec: Consultative Notes

## Capability
Sistema de anotaciones técnicas inline en celdas de la matriz de coberturas, permitiendo al analista agregar insights personalizados que se persisten y se incluyen en exportaciones.

## User Story
**Como** analista técnico de seguros
**Quiero** agregar notas técnicas a las celdas de coberturas
**Para** explicar a mi cliente por qué una opción es mejor aunque no sea la más barata

## ADDED Requirements

### Requirement: Editor inline de notas
El sistema SHALL permitir agregar notas a cualquier celda de la matriz mediante doble-clic o botón dedicado.

#### Scenario: Abrir editor
- **WHEN** el usuario hace doble clic en una celda de cobertura
- **THEN** la celda se transforma en un editor de texto pequeño
- **AND** permite escribir texto libre (markdown soportado)
- **AND** incluye botones "Guardar" y "Cancelar"

#### Scenario: Cancelar edición
- **WHEN** el usuario presiona Escape o hace clic en "Cancelar"
- **THEN** el editor se cierra sin guardar cambios
- **AND** la celda vuelve a su estado normal

#### Scenario: Guardar nota
- **WHEN** el usuario hace clic en "Guardar" o presiona Ctrl+Enter
- **THEN** la nota se guarda en el estado local del reporte
- **AND** la celda muestra un icono de nota (📌) indicando que tiene contenido

### Requirement: Visualización de notas
El sistema SHALL mostrar visualmente qué celdas tienen notas y permitir verlas fácilmente.

#### Scenario: Indicador de nota
- **WHEN** una celda tiene una nota guardada
- **THEN** se muestra un icono pequeño de nota (📌) en la esquina superior derecha de la celda
- **AND** el icono es clicable para ver la nota completa

#### Scenario: Tooltip de nota
- **WHEN** el usuario hace hover sobre el icono de nota
- **THEN** se muestra un tooltip con el contenido completo de la nota
- **AND** el tooltip soporta renderizado de markdown básico

#### Scenario: Múltiples notas
- **WHEN** una celda tiene nota y también evidencia RAG
- **THEN** ambos indicadores se muestran sin solaparse
- **AND** la celda mantiene legibilidad del valor principal

### Requirement: Persistencia de notas
Las notas SHALL persistirse en el objeto de análisis y estar disponibles en recargas de página.

#### Scenario: Persistencia local
- **WHEN** el usuario agrega una nota
- **THEN** se almacena en el estado del componente ComparisonReport
- **AND** se incluye en el objeto report completo

#### Scenario: Exportación con notas
- **WHEN** el usuario exporta el reporte a PDF o Excel
- **THEN** las notas se incluyen en una columna dedicada titulada "Insights del Consultor"
- **AND** las notas se renderizan con formato markdown convertido a texto enriquecido

### Requirement: Seguridad de contenido
El sistema SHALL sanitizar el contenido de las notas para prevenir XSS.

#### Scenario: Sanitización de input
- **WHEN** el usuario ingresa contenido HTML o scripts en una nota
- **THEN** el sistema sanitiza el input removiendo tags peligrosos
- **AND** solo permite markdown básico (negritas, listas, links)

#### Scenario: Validación backend
- **WHEN** las notas se envían al servidor para persistencia
- **THEN** el backend valida y sanitiza el contenido con DOMPurify
- **AND** rechaza contenido que exceda 2000 caracteres

## Dependencies
- Componente UnifiedCoverageMatrix
- Servicios de exportación (pdfService, excel export)
- marked.js y DOMPurify (posibles dependencias nuevas)
