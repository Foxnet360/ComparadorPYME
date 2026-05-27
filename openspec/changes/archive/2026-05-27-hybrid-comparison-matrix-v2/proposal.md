# Proposal: hybrid-comparison-matrix-v2

## Why

El comparador de seguros actual utiliza una cuadrícula de visualización en React estructurada en celdas densas que acumulan sumas aseguradas, deductibles y exclusiones en un único bloque visual. Aunque es funcional para el análisis computacional, esta maquetación diverge del esquema de informes técnicos minimalistas de seguros (como la comparativa monocromática generada en `comparativa_seguros.xlsx`), dificultando que los analistas técnicos y los tomadores comparen de forma horizontal y limpia cada deducible y desglose al lado del valor asegurado. 

Para resolver de raíz esta deuda técnica y ofrecer una experiencia homogénea premium, unificaremos el modelo de datos de visualización y exportación bajo un esquema común de **Matriz Orientada a Filas Agrupadas (Row-Grouped Matrix)**, logrando una correspondencia pixel a pixel entre la pantalla del dashboard y el reporte Excel exportable.

## What Changes

1. **Unificación del Esquema de Datos Visuales (Single Source of Truth)**:
   * Implementación de un transformador unificado que tome el JSON estructurado `QuoteData[]` y genere una estructura plana de filas de matriz (`MatrixRow[]`), donde cada sección canónica es un encabezado y sus variables específicas (Valor Asegurado, Deducible, Detalles) se desglosan en filas independientes.
2. **Rediseño del Dashboard Web (React UI)**:
   * Actualización del componente `UnifiedCoverageMatrix.tsx` para renderizar el esquema de filas agrupadas de forma nativa, reemplazando la vista de celdas consolidadas y adoptando la estética monocromática gris y azul del reporte técnico.
3. **Mecanismo de Exportación Determinista a Excel**:
   * Creación de un servicio de renderizado de Excel (`excelGenerator.ts`) que consuma exactamente el mismo array `MatrixRow[]` y genere de forma determinista el archivo de exportación `.xlsx` con estilos impecables (portada, alternación de filas, formatos de moneda y porcentajes, sin cuadrículas), garantizando cero alucinaciones y paridad absoluta con el dashboard web.

## Capabilities

### New Capabilities
- `row-grouped-comparison-matrix`: Motor dinámico de alineación de coberturas y unificación de visuales dashboard-Excel mediante filas agrupadas.
- `hybrid-excel-export`: Servicio determinista de compilación y formateo de reportes en pestañas (Portada, Coberturas, Primas y Costos) con estilo monocromático.

### Modified Capabilities
- `quote-analysis-v2`: Ajuste para estructurar campos de desglose de amparos adicionales que alimenten las filas descriptivas de la matriz.

## Impact

- **Frontend**: `components/UnifiedCoverageMatrix.tsx` y `components/ComparisonReport.tsx` para adaptar la UI al nuevo esquema dinámico de filas.
- **Backend Services**: Creación de `server/src/services/matrixTransformer.ts` and `server/src/services/excelGenerator.ts`.
- **Rutas de API**: Nueva ruta `GET /api/analysis/:id/export` para descargar el Excel unificado.
- **Dependencias**: Uso de la librería `exceljs` en el backend para la generación del Excel con los estilos requeridos.
