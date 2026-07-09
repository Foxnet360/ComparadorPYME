# Spec: Unified Coverage Matrix (Delta)

## Capability
Visualización de comparación de cotizaciones en una matriz de 14 categorías fijas con indicadores de confianza, manejo de coberturas no categorizadas agrupadas, y visualización de deducibles con gauges.

## User Story
**Como** usuario del comparador
**Quiero** ver todas las coberturas organizadas en categorías estándar
**Para** comparar fácilmente qué incluye cada aseguradora

## MODIFIED Requirements

### Requirement: Matriz de comparación unificada

El frontend SHALL renderizar la comparación en una matriz de filas granulares agrupadas por secciones. Cada sección MAY contener sub-filas como Edificio, Contenidos, Mercancías, deducibles por cobertura, Prima con IVA, y Forma de Pago.

(Previously: renderizaba exactamente 14 filas fijas de categorías canónicas.)

#### Scenario: Visualización de secciones

- WHEN el usuario ve el tab "Coberturas" del reporte de comparación
- THEN la tabla muestra encabezados de sección (e.g., `INFORMACIÓN GENERAL`, `BIENES ASEGURADOS`)
- AND cada sección muestra sus filas granulares debajo del encabezado
- AND se preserva el orden canónico de sub-filas dentro de cada sección

#### Scenario: Cobertura presente

- WHEN una celda contiene un valor extraído
- THEN la celda muestra el valor asegurado o deducible
- AND muestra el badge de confianza derivado de la señal de extracción

#### Scenario: Cobertura ausente

- WHEN una cotización NO incluye un valor para una sub-fila canónica
- THEN la celda muestra "No incluida" en gris claro

#### Scenario: Disparador de visor PDF

- WHEN una celda tiene evidencia RAG con pageNumber
- THEN se muestra un botón "Ver Evidencia" o el número de página como link clicable
- AND al hacer clic se abre el visor PDF integrado en la página correspondiente

#### Scenario: Doble-clic para notas

- WHEN el usuario hace doble clic en una celda de cobertura
- THEN se abre el editor inline de notas consultivas
- AND la celda muestra un icono de nota si tiene contenido guardado

### Requirement: Semántica ARIA para accesibilidad
La matriz SHALL implementar roles y atributos ARIA para cumplir con WCAG 2.1 AA.

#### Scenario: Roles ARIA
- **WHEN** la matriz se renderiza
- **THEN** el contenedor tiene role="grid" y aria-label="Matriz de coberturas de seguros"
- **AND** cada fila tiene role="row" con aria-rowindex
- **AND** cada celda interactiva tiene role="gridcell" y tabindex="0"

#### Scenario: Navegación por teclado
- **WHEN** el usuario navega con teclado (flechas, Tab, Enter, Escape)
- **THEN** las flechas mueven el foco entre celdas adyacentes
- **AND** Enter activa la acción principal de la celda (abrir corrección o visor PDF)
- **AND** Escape cierra cualquier popup o editor abierto

#### Scenario: Anuncios para screen readers
- **WHEN** una celda recibe foco
- **THEN** el screen reader anuncia el contenido: "[Categoría], [Aseguradora], [Valor], [Estado]"
- **AND** cuando una corrección se guarda, se anuncia: "Corrección guardada para [cobertura]"

### Requirement: Virtualización de matriz grande
La matriz SHALL implementar virtualización cuando el número total de celdas excede 100.

#### Scenario: Virtualización activada
- **WHEN** hay más de 3 aseguradoras (resultando en >100 celdas)
- **THEN** solo las filas visibles en el viewport se renderizan en el DOM
- **AND** el scroll permanece fluido sin lag

#### Scenario: Foco persistente
- **WHEN** el usuario navega por teclado en una matriz virtualizada
- **THEN** el foco se mantiene en la celda correcta aunque las filas entren/salgan del viewport

### Requirement: Indicadores de confianza visual

Cada celda de cobertura SHALL mostrar el nivel de confianza del match o de la extracción mediante badges de color. El valor de confianza MUST provenir del campo `confidence` de la celda, no de un valor hardcodeado.

(Previously: los badges se basaban en `matchConfidence` fijado o heredado del motor de matching.)

#### Scenario: Confianza alta

- WHEN cell.confidence >= 0.9
- THEN se muestra badge verde con tooltip "Match exacto"

#### Scenario: Confianza media

- WHEN cell.confidence entre 0.7 y 0.89
- THEN se muestra badge amarillo con tooltip "Match aproximado"

#### Scenario: Confianza baja

- WHEN cell.confidence < 0.7
- THEN se muestra badge rojo con tooltip "Revisar match"

#### Scenario: Tooltip con nombre original

- WHEN el usuario hace hover sobre una celda de cobertura
- THEN el tooltip muestra el nombre original extraído del PDF, el nombre canónico, el método de match usado, Y la fuente del valor (extraído/calculado/inferido)

### Requirement: Responsive design
La matriz unificada SHALL ser usable en pantallas de diferentes tamaños.

#### Scenario: Scroll horizontal
- **WHEN** hay más de 3 cotizaciones
- **THEN** la tabla permite scroll horizontal manteniendo la columna de categorías fija

#### Scenario: Vista móvil
- **WHEN** el ancho de pantalla es < 768px
- **THEN** la tabla cambia a tarjetas apiladas por categoría, mostrando una aseguradora por tarjeta

## ADDED Requirements

### Requirement: Encabezado de sección como fila propia

La matriz SHALL renderizar cada sección como una fila de encabezado que abarca todas las columnas, separando visualmente los grupos de sub-filas.

#### Scenario: Render de encabezado

- WHEN la matriz recibe filas con `section` definida
- THEN se inserta una fila de encabezado con el nombre de la sección
- AND las filas de datos siguen directamente debajo de su encabezado

## Dependencies
- Componente ComparisonReport
- Componente PdfViewer (nuevo)
- Componente AuditWizard (nuevo)
- pdfjs-dist

## Delta from change: mejorar-matriz-coberturas

## MODIFIED Requirements

### Requirement: Matriz de comparación unificada

The frontend SHALL render comparison in a matrix of granular rows. It MUST pass backend `matrix` to `UnifiedCoverageMatrix` and render a responsive Header Metadata Card with the 9 extracted fields. If backend `matrix` is absent, it MUST fall back to client-side construction with the same grouping logic.

(Previously: rendered a granular matrix by ignoring the backend `MatrixRow[]` and reconstructing it client-side without a metadata card.)

#### Scenario: Matrix visualization & cell actions
- WHEN user views Coberturas tab or triggers cell actions
- THEN table shows sections with granular rows, preserving canonical order
- AND cells display values with confidence badges, clickable citations, or double-click inline notes editor

#### Scenario: Backend matrix & header metadata card
- GIVEN report with pre-aligned backend matrix and header metadata
- WHEN rendered
- THEN `UnifiedCoverageMatrix` MUST use backend rows directly
- AND render responsive Header Metadata Card with all 9 fields at top

#### Scenario: Fallback client-side grouping & tab filtering
- GIVEN report with no backend `matrix`
- WHEN rendered or filtered by tabs
- THEN it SHALL fall back to client-side grouping (Bienes, Deducibles, Sustracción, Financial)
- AND financials tab MUST map the backend financial section ID
- AND deductibles group under parent category when provided

