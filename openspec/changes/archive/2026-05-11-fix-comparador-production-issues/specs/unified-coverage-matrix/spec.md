## MODIFIED Requirements

### FR-1: Matriz de comparación unificada
El frontend SHALL renderizar la comparación de coberturas en una matriz de exactamente 14 filas fijas, una por cada categoría canónica de la Plantilla PYME.

#### Scenario: Visualización de 14 categorías
- **WHEN** el usuario ve el tab "Coberturas" del reporte de comparación
- **THEN** la tabla muestra 14 filas en orden fijo (Incendio, Lucro Cesante, ..., Terremoto) con columnas por cada aseguradora

#### Scenario: Cobertura presente
- **WHEN** una cotización incluye una cobertura que mapea a una categoría
- **THEN** la celda muestra el valor asegurado, deducible, y badge de confianza del match

#### Scenario: Cobertura ausente
- **WHEN** una cotización NO incluye una cobertura para una categoría
- **THEN** la celda muestra "No incluida" en gris claro

### FR-2: Indicadores de confianza visual
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
- **THEN** el tooltip muestra el nombre original extraído del PDF, el nombre canónico, y el método de match usado

### FR-3: Sección de coberturas no categorizadas
El frontend SHALL mostrar coberturas que no pudieron mapearse a ninguna categoría en una sección separada.

#### Scenario: Coberturas sin match
- **WHEN** hay coberturas con categoryId null
- **THEN** se muestran en una sección "Coberturas No Categorizadas" debajo de la matriz principal, con fondo amarillo claro

#### Scenario: Sin coberturas no categorizadas
- **WHEN** todas las coberturas tienen categoryId asignado
- **THEN** la sección "Coberturas No Categorizadas" no se muestra

### FR-4: Manejo de múltiples coberturas por categoría
El frontend SHALL manejar el caso donde una cotización tiene múltiples coberturas que mapean a la misma categoría canónica.

#### Scenario: Múltiples coberturas en misma categoría
- **WHEN** una cotización tiene 2+ coberturas con el mismo categoryId
- **THEN** la celda muestra ambas coberturas separadas por línea divisoria, con indicador "Múltiples coberturas"

### FR-5: Responsive design
La matriz unificada SHALL ser usable en pantallas de diferentes tamaños.

#### Scenario: Scroll horizontal
- **WHEN** hay más de 3 cotizaciones
- **THEN** la tabla permite scroll horizontal manteniendo la columna de categorías fija

#### Scenario: Vista móvil
- **WHEN** el ancho de pantalla es < 768px
- **THEN** la tabla cambia a tarjetas apiladas por categoría, mostrando una aseguradora por tarjeta

## ADDED Requirements

### Requirement: Matching fuzzy cuando tesauro no está disponible
El sistema DEBE usar matching fuzzy por nombre cuando el `categoryId` es undefined debido a que el tesauro no cargó.

#### Scenario: Tesauro no disponible
- **WHEN** el tesauro no se cargó correctamente
- **THEN** la matriz busca coincidencias por nombre canónico usando fuzzy matching
- **AND** muestra un indicador visual de que el match es aproximado

#### Scenario: Variaciones de nombres
- **WHEN** una cobertura se llama "RC" o "Responsabilidad Civil"
- **THEN** el sistema las mapea a la categoría "Responsabilidad Civil (RCE)"
- **AND** muestra el nombre original en tooltip

#### Scenario: Fallback sin tesauro
- **WHEN** ni el categoryId ni el fuzzy matching encuentran una categoría
- **THEN** la cobertura se muestra en "Coberturas No Categorizadas"
- **AND** se registra un log para mejorar el tesauro
