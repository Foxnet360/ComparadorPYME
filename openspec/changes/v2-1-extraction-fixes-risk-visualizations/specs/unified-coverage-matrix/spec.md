# Spec: Unified Coverage Matrix

## Capability
Visualización de comparación de cotizaciones en una matriz de 14 categorías fijas con indicadores de confianza, manejo de coberturas no categorizadas agrupadas, y visualización de deducibles con gauges.

## User Story
**Como** usuario del comparador
**Quiero** ver todas las coberturas organizadas en categorías estándar
**Para** comparar fácilmente qué incluye cada aseguradora

## ADDED Requirements

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
El frontend SHALL mostrar coberturas que no pudieron mapearse a ninguna categoría canónica en una sección separada agrupada por tipo.

#### Scenario: Coberturas sin match
- **WHEN** hay coberturas con categoryId que NO es de las 14 canónicas
- **THEN** se muestran en una sección "Coberturas Adicionales" debajo de la matriz principal
- **AND** están agrupadas por tipo: "Asistencias", "Servicios", "Amparos Adicionales", "Otros"
- **AND** cada grupo es expandible/collapsible

#### Scenario: Sin coberturas no categorizadas
- **WHEN** todas las coberturas tienen categoryId de las 14 canónicas
- **THEN** la sección "Coberturas Adicionales" no se muestra

#### Scenario: Coberturas adicionales por aseguradora
- **WHEN** el usuario expande un grupo de coberturas adicionales
- **THEN** se muestra tabla con columnas por aseguradora
- **AND** cada celda muestra si la aseguradora ofrece esa cobertura adicional

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

## MODIFIED Requirements

### FR-6: Visualización de deducibles con gauge
**Reason**: Previous text-only deductible display was confusing and error-prone

#### Scenario: Gauge verde (sin deducible)
- **WHEN** un deducible es "No aplica", "Sin deducible", "Incluido", "Aplica"
- **THEN** se muestra indicador circular verde
- **AND** tooltip muestra "Sin deducible / Incluido"

#### Scenario: Gauge amarillo (deducible moderado)
- **WHEN** un deducible es porcentaje entre 1% y 10%
- **THEN** se muestra indicador circular amarillo
- **AND** tooltip muestra deducible exacto

#### Scenario: Gauge rojo (alto deducible)
- **WHEN** un deducible es > 10% o "NO ESPECIFICADO"
- **THEN** se muestra indicador circular rojo
- **AND** tooltip muestra deducible exacto o alerta "No especificado"

#### Scenario: Gauge con valor monetario
- **WHEN** un deducible es monto fijo (ej: "5 SMMLV")
- **THEN** se muestra indicador circular con color según monto relativo al mercado
- **AND** tooltip muestra monto exacto y comparativa

### FR-7: Eliminación de toggle RAG
**Reason**: Toggle "Referencias RAG" existed but did nothing - caused user confusion

#### Scenario: No RAG toggle
- **WHEN** el usuario ve el reporte de comparación
- **THEN** NO hay botón toggle "Referencias RAG"
- **AND** las referencias de clausulado se muestran en la pestaña Auditoría, no en la matriz

## Dependencies
- Componente ComparisonReport
- Datos de cotizaciones con campos de mapeo semántico
- Recharts para gauges (radial chart)
