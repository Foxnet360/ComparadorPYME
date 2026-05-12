# Spec: Risk Visualizations

## Capability
Visualizaciones interactivas de riesgo en la sección de auditoría: heatmap de coberturas × aseguradoras, gráfico de radar comparativo, y gauges semáforo de deducibles.

## User Story
**Como** usuario del comparador
**Quiero** ver visualmente los niveles de riesgo por cobertura y aseguradora
**Para** identificar rápidamente diferencias críticas y puntos de atención

## ADDED Requirements

### Requirement: Heatmap de riesgos
El sistema SHALL renderizar una matriz visual donde cada celda represente el nivel de riesgo de una cobertura para una aseguradora específica.

#### Scenario: Heatmap con datos completos
- **WHEN** el usuario está en la pestaña "Auditoría de Riesgos"
- **THEN** se muestra un heatmap con 14 filas (coberturas) y N columnas (aseguradoras)
- **AND** cada celda tiene color según nivel de riesgo: verde (bajo), amarillo (medio), rojo (alto), gris (no incluido)

#### Scenario: Heatmap con tooltip
- **WHEN** el usuario hace hover sobre una celda del heatmap
- **THEN** se muestra tooltip con: valor asegurado, deducible, score de riesgo, y razón del nivel

#### Scenario: Heatmap scrollable
- **WHEN** hay más de 4 aseguradoras
- **THEN** el heatmap permite scroll horizontal manteniendo filas de cobertura visibles

### Requirement: Radar chart por aseguradora
El sistema SHALL mostrar un gráfico de radar comparando dimensiones de riesgo por aseguradora.

#### Scenario: Radar con 5 dimensiones
- **WHEN** el usuario hace clic en el nombre de una aseguradora
- **THEN** se abre modal con radar chart de 5 ejes: Precio, Cobertura, Deducibles, Cláusulas, Riesgo General
- **AND** cada eje tiene score de 0-100

#### Scenario: Comparación múltiple en radar
- **WHEN** el usuario selecciona 2+ aseguradoras
- **THEN** el radar muestra líneas superpuestas de diferente color por aseguradora

### Requirement: Gauge semáforo de deducibles
El sistema SHALL mostrar indicadores visuales tipo semáforo para cada deducible en la matriz de coberturas.

#### Scenario: Gauge verde (bajo riesgo)
- **WHEN** un deducible es "No aplica" o "0%"
- **THEN** se muestra indicador verde con tooltip "Sin deducible"

#### Scenario: Gauge amarillo (riesgo medio)
- **WHEN** un deducible está entre 1% y 10%
- **THEN** se muestra indicador amarillo con tooltip "Deducible moderado"

#### Scenario: Gauge rojo (riesgo alto)
- **WHEN** un deducible es >10% o no está especificado
- **THEN** se muestra indicador rojo con tooltip "Alto deducible o no especificado"

#### Scenario: Gauge informativo
- **WHEN** el usuario hace hover sobre un gauge
- **THEN** se muestra deducible exacto, comparativa con mercado, y recomendación

### Requirement: Responsive de visualizaciones
Todas las visualizaciones SHALL ser responsivas y funcionar en desktop y tablet.

#### Scenario: Vista móvil
- **WHEN** el ancho de pantalla es < 768px
- **THEN** el heatmap cambia a lista vertical por aseguradora
- **AND** el radar se muestra en pantalla completa

## Dependencies
- Recharts (existente)
- Tailwind CSS (existente)
- Datos de análisis de riesgo del backend
