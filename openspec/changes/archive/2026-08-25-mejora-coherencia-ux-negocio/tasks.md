## 1. Flujo de Reintento y Estado de Error (Resilience)

- [x] 1.1 Modificar `App.tsx` para agregar `handleRetry()` en lugar de `handleReset()` tras un error en `AppStatus.ERROR`.
- [x] 1.2 Agregar botón explícito "Reintentar auditoría" en la vista de error de `App.tsx` que conserve `quoteFiles`, `clauseFiles`, `selectedClauseIds` y `selectedClient`.

## 2. Propagación de Correcciones Manuales (Correction Sync)

- [x] 2.1 Actualizar `CorrectionUI.tsx` y `ComparisonReport.tsx` para conectar la edición de campos con una función `handleUpdateReportQuote`.
- [x] 2.2 Garantizar que los cambios manuales muten el estado global `report` y que `generatePDF` lea la versión actualizada con las correcciones aplicadas.

## 3. Selector de Dominio y Feedback de Cliente (UI Flow Alignment)

- [x] 3.1 Mover la selección de ramo (`pyme` vs `autos`) desde `FileUploader` hacia el encabezado de configuración en `App.tsx`.
- [x] 3.2 Asegurar el reseteo predeterminado de `domain` al valor `'pyme'` al presionar `handleReset()` o al cambiar de cliente.
- [x] 3.3 Agregar mensaje de retroalimentación interactiva y CTA claro en `FileUploader.tsx` indicando que se requiere seleccionar cliente.

## 4. Adaptación de la Interfaz del Reporte al Ramo (Domain Presentation)

- [x] 4.1 Modificar `ComparisonReport.tsx` y componentes hijos para adaptar títulos, agrupaciones y etiquetas según si `report.domain` (o `domain`) es `'pyme'` o `'autos'`.
- [x] 4.2 Ejecutar pruebas (`npm test`) y verificación de compilación (`tsc --noEmit`).
