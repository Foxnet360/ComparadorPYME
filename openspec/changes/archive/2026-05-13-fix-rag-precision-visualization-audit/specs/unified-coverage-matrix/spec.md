## MODIFIED Requirements

### Requirement: Matriz de comparación unificada
El frontend SHALL renderizar la comparación de coberturas en una matriz de exactamente 14 filas fijas, una por cada categoría canónica de la Plantilla PYME.

#### Scenario: Visualización de 14 categorías
- **WHEN** el usuario ve el tab "Coberturas" del reporte de comparación
- **THEN** la tabla muestra 14 filas en orden fijo (Incendio, Lucro Cesante, ..., Terremoto) con columnas por cada aseguradora

#### Scenario: Cobertura presente
- **WHEN** una cotización incluye una cobertura que mapea a una categoría
- **THEN** la celda muestra el valor asegurado, deducible, badge de confianza del match, Y badge de origen del valor

#### Scenario: Cobertura ausente
- **WHEN** una cotización NO incluye una cobertura para una categoría
- **THEN** la celda muestra "No incluida" en gris claro

### Requirement: Indicadores de confianza visual
Cada celda de cobertura SHALL mostrar el nivel de confianza del match semántico mediante badges de color.

#### Scenario: Confianza alta
- **WHEN** matchConfidence >= 0.9
- **THEN** se muestra badge verde con tooltip "Match exacto"

#### Scenario: Confianza media
- **WHEN** matchConfidence entre 0.7 y 0.89
- **THEN** se muestra badge amarillo con tooltip "Match aproximado"

#### Scenario: Confianza baja
- **WHEN** matchConfidence < 0.7
- **THEN** se muestra badge rojo con tooltip "Revisar match"

#### Scenario: Tooltip con nombre original
- **WHEN** el usuario hace hover sobre una celda de cobertura
- **THEN** el tooltip muestra el nombre original extraído del PDF, el nombre canónico, el método de match usado, Y la fuente del valor (extraído/calculado/inferido)

### Requirement: Sección de coberturas no categorizadas
El frontend SHALL mostrar coberturas que no pudieron mapearse a ninguna categoría en una sección separada.

#### Scenario: Coberturas sin match
- **WHEN** hay coberturas con categoryId null
- **THEN** se muestran en una sección "Coberturas No Categorizadas" debajo de la matriz principal, con fondo amarillo claro

#### Scenario: Sin coberturas no categorizadas
- **WHEN** todas las coberturas tienen categoryId asignado
- **THEN** la sección "Coberturas No Categorizadas" no se muestra

#### Scenario: Vista matriz de no categorizadas
- **WHEN** el usuario selecciona vista "Matriz" en coberturas no categorizadas
- **THEN** se muestra una tabla con filas = coberturas únicas y columnas = TODAS las aseguradoras
- **AND** si una aseguradora no tiene esa cobertura, la celda muestra "No incluida"
- **AND** si múltiples aseguradoras tienen la misma cobertura, se muestran en sus respectivas columnas

### Requirement: Manejo de múltiples coberturas por categoría
El frontend SHALL manejar el caso donde una cotización tiene múltiples coberturas que mapean a la misma categoría canónica.

#### Scenario: Múltiples coberturas en misma categoría
- **WHEN** una cotización tiene 2+ coberturas con el mismo categoryId
- **THEN** la celda muestra ambas coberturas separadas por línea divisoria, con indicador "Múltiples coberturas"

### Requirement: Responsive design
La matriz unificada SHALL ser usable en pantallas de diferentes tamaños.

#### Scenario: Scroll horizontal
- **WHEN** hay más de 3 cotizaciones
- **THEN** la tabla permite scroll horizontal manteniendo la columna de categorías fija

#### Scenario: Vista móvil
- **WHEN** el ancho de pantalla es < 768px
- **THEN** la tabla cambia a tarjetas apiladas por categoría, mostrando una aseguradora por tarjeta

## ADDED Requirements

### Requirement: Value source indicators
El frontend SHALL display indicators showing the source of extracted coverage values.

#### Scenario: Extracted value
- **WHEN** a value has source = 'extracted'
- **THEN** no special indicator is shown (default)

#### Scenario: Calculated value
- **WHEN** a value has source = 'calculated'
- **THEN** a calculator icon (🧮) is displayed next to the value
- **AND** tooltip explains: "Valor calculado o inferido, no encontrado literalmente en el documento"

#### Scenario: Inferred value
- **WHEN** a value has source = 'inferred'
- **THEN** a lightbulb icon (💡) is displayed next to the value
- **AND** tooltip explains: "Valor derivado de cálculo basado en el documento"

### Requirement: Sublimit indicators in matrix cells
El frontend SHALL display sublimit information in coverage matrix cells when available.

#### Scenario: Sublimit present
- **WHEN** a coverage has an extracted sublimit (e.g., per_event, per_item, aggregate)
- **THEN** a sublimit badge is displayed below the coverage value
- **AND** the badge shows the sublimit type and amount
- **AND** hovering reveals full sublimit details

#### Scenario: Deductible cap
- **WHEN** a deductible has a cap (e.g., "Máx. 500 SMMLV")
- **THEN** a cap indicator is shown next to the deductible badge
- **AND** the effective deductible is calculated and displayed
