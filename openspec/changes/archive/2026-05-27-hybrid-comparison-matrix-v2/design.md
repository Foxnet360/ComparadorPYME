# Design: hybrid-comparison-matrix-v2

## Context

El comparador de seguros PYME actual procesa las cotizaciones de forma aislada y las renderiza en una cuadrícula React de 14 categorías canónicas estáticas. Cada celda de la cuadrícula aglutina todos los datos de la cobertura (valor, deducible en un badge, amparos específicos). Esta acumulación visual en una sola celda diverge del formato de los informes técnicos monocromáticos impresos que usan los analistas comerciales (como `comparativa_seguros.xlsx`), los cuales separan cada variable (Valor Asegurado, Deducible, Incluye) en filas independientes agrupadas por cabeceras de sección. 

Además, la exportación actual a Excel es rígida, compleja y propensa a desalinearse con el dashboard web, lo que aumenta la deuda técnica y reduce la mantenibilidad.

## Goals / Non-Goals

**Goals:**
* **Unificación de Lógica de Layout**: Crear una estructura de datos común (`MatrixRow[]`) que sirva tanto para el React render de la UI como para el servicio de exportación a Excel.
* **Rediseño Visual Monocromático**: Reorganizar la cuadrícula del Dashboard web con filas de datos independientes y cabeceras agrupadas limpias que repliquen la estética de `comparativa_seguros.xlsx`.
* **Exportación Determinista sin Alucinaciones**: Implementar un servicio de exportación binario (`exceljs`) que consuma la estructura unificada, garantizando 100% de coincidencia numérica y visual con la web.

**Non-Goals:**
* Modificar el esquema de base de datos de Supabase o la estructura de tablas de cotizaciones persistidas (`QuoteData[]`).
* Modificar el motor de extracción de PDFs original (el transformador trabajará sobre el resultado ya extraído y validado).

## Decisions

### Decision 1: Modelo de Datos Plano y Tipado en Filas (`MatrixRow`)
**Decisión**: Diseñar un transformador que unifique la comparación en una lista plana de filas (`MatrixRow[]`). Cada fila representa o una cabecera de sección, una variable técnica de cobertura, o datos financieros/metadatos:

```typescript
export type MatrixRowType = 'header' | 'data' | 'spacer';

export interface MatrixCell {
  value: string;
  isExcluded: boolean;
  isWinner: boolean;
  notes?: string;
  pageNumber?: number;
  confidence?: number;
}

export interface MatrixRow {
  type: MatrixRowType;
  id: string;
  label: string;
  sectionId: number;
  cells: MatrixCell[];
}
```

* **Razón**: Permite a React y a Excel mapear una estructura de datos secuencial simple. Evita código complejo de maquetación en ambas capas.
* **Alternativa considerada**: Mantener la cuadrícula React y re-escribir lógica de coordenadas complejas en Excel. *Rechazada*: Duplica la deuda técnica y aumenta el riesgo de discrepancias entre lo que ve el usuario en la web y lo que descarga.

### Decision 2: Renderizador Excel Basado en Plantilla Determinista (`exceljs`)
**Decisión**: Utilizar la librería `exceljs` en el backend para iterar sobre la estructura `MatrixRow[]` unificada y aplicar estilos monocromáticos (azul pastel `#E6F0FA`, gris `#F8FAFC`, fuentes negritas para cabeceras y totales, formato de moneda `$#,##0` y sin líneas de cuadrícula de fondo).

* **Razón**: Cero coste de API y velocidad instantánea (<100ms) sin riesgo de alucinaciones matemáticas que ocurren cuando un LLM genera el Excel de forma directa.
* **Alternativa considerada**: LLM Generativo de código `openpyxl`. *Rechazada*: Aunque es muy flexible, introduciría deuda de sandboxing de ejecución de código Python dinámico y retrasos por llamadas de red al modelo.

## Risks / Trade-offs

* **[Riesgo] Pérdida de interactividad en Excel**: En el Dashboard React, el usuario puede ver badges de confianza y enlaces al RAG con el número de página original de origen. En Excel, esta interactividad rica no se traduce de forma nativa.
  * *Mitigación*: Se inyectarán estos detalles en forma de "Comentarios de Celda" (Excel Comments) o en notas textuales en la fila `Incluye/Detalles` para preservar la trazabilidad sin sobrecargar el layout visual.

* **[Riesgo] Altura variable de celdas por textos largos**: Ciertas descripciones de "Incluye" o deductibles extensos pueden desbordar el layout de Excel.
  * *Mitigación*: Se activará la propiedad `wrapText = true` en las columnas del reporte de Coberturas y se configurará un ancho generoso por defecto para las columnas de las aseguradoras (mínimo 30 caracteres).
