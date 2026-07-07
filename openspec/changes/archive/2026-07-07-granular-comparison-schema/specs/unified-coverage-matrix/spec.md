# Delta for Unified Coverage Matrix

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

## ADDED Requirements

### Requirement: Encabezado de sección como fila propia

La matriz SHALL renderizar cada sección como una fila de encabezado que abarca todas las columnas, separando visualmente los grupos de sub-filas.

#### Scenario: Render de encabezado

- WHEN la matriz recibe filas con `section` definida
- THEN se inserta una fila de encabezado con el nombre de la sección
- AND las filas de datos siguen directamente debajo de su encabezado
