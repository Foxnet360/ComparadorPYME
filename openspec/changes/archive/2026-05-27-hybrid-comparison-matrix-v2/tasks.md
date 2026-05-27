# Tasks: hybrid-comparison-matrix-v2

## 1. Setup & Shared Schema

- [x] 1.1 Definir interfaces de TypeScript `MatrixRow` y `MatrixCell` en el archivo compartido de tipos.
- [x] 1.2 Instalar e integrar la dependencia `exceljs` en el backend `package.json` para la exportación binaria.

## 2. Motor de Transformación (matrixTransformer.ts)

- [x] 2.1 Crear el servicio `matrixTransformer.ts` en `server/src/services/` para alinear coberturas canónicas en filas de datos y cabeceras agrupadas.
- [x] 2.2 Implementar la clasificación y mapeo de amparos exclusivos (coberturas exóticas) en una sección dedicada.
- [x] 2.3 Implementar la estructura e inyección de datos financieros (primas y costos) y metadatos complementarios en la matriz.
- [x] 2.4 Escribir pruebas unitarias y de integración en `matrixTransformer.test.ts` para verificar la alineación con un lote de cotizaciones simuladas.

## 3. Rediseño del Dashboard React (Frontend)

- [x] 3.1 Refactorizar `components/UnifiedCoverageMatrix.tsx` para consumir y mapear el esquema plano de filas `MatrixRow[]`.
- [x] 3.2 Implementar los estilos monocromáticos en Tailwind CSS (cabeceras en azul pastel, filas alternadas, etiquetas en gris).
- [x] 3.3 Integrar badges de deducibles, íconos de trofeos de mejor opción y popovers interactivos para visualización técnica en las celdas.
- [x] 3.4 Verificar la correcta renderización web con el ejemplo real de `laser-home`.

## 4. Servicio de Renderizado Excel (Backend)

- [x] 4.1 Crear el servicio `excelGenerator.ts` en el backend usando la librería `exceljs` para iterar de forma determinista sobre `MatrixRow[]`.
- [x] 4.2 Desarrollar el constructor de la pestaña 'Portada' aplicando el estilo estético minimalista.
- [x] 4.3 Desarrollar el constructor de la pestaña 'Coberturas y Deducibles' aplicando bordes finos, fondos azul pastel y ocultando gridlines.
- [x] 4.4 Desarrollar el constructor de la pestaña 'Primas y Costos' formateando monedas y metadatos complementarios.
- [x] 4.5 Exponer la ruta de API `GET /api/analysis/:id/export` para descargar el reporte unificado.
- [x] 4.6 Agregar un botón de acción "Descargar Excel Comparativo" en el Dashboard React que invoque la ruta de API.

## 5. Verificación & Estabilización

- [x] 5.1 Realizar verificación de paridad cruzada entre la vista del Dashboard web y la exportación descargada del ejemplo `laser-home`.
- [x] 5.2 Asegurar que el sistema compila al 100% de manera nativa mediante `npm run build` y que las pruebas existentes pasen exitosamente.
