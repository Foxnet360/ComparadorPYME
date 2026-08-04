## Context

Actualmente el flujo de trabajo en la UI de auditoría de cotizaciones presenta desacoplamientos entre el estado global (`App.tsx`), los componentes de selección y carga (`FileUploader`, `ClientSelector`, `ClauseSelector`), el manejo de errores y la sincronización de correcciones de usuario en la matriz de comparación (`ComparisonReport` y `CorrectionUI`).

## Goals / Non-Goals

**Goals:**
- Implementar un flujo de reintento en caso de error (`AppStatus.ERROR`) que mantenga intactos los archivos e insumos de entrada.
- Sincronizar dinámicamente las correcciones de `CorrectionUI` con el estado `report` global para que la matriz y el PDF reflejen los datos editados por el corredor.
- Reubicar el selector de ramo (PYME / Autos) en la barra principal de configuración del análisis y garantizar su reseteo adecuado.
- Mejorar la experiencia visual cuando la subida de cotizaciones requiere la selección previa de un cliente.
- Adaptar las agrupaciones y terminología en `ComparisonReport` según el dominio seleccionado (`pyme` vs `autos`).

**Non-Goals:**
- No se modificarán las APIs ni esquemas de la base de datos backend.
- No se reescribirá la ontología de extracción con Gemini.

## Decisions

1. **Separación de `handleRetry` vs `handleReset` en `App.tsx`**:
   - *Decisión*: Crear una función explícita `handleRetry()` que cambie el estado de `AppStatus.ERROR` a `AppStatus.ANALYZING` y re-ejecute `handleAnalyze()`, sin invocar `handleReset()`.
   - *Alternativa*: Resetear todo tras un error (comportamiento actual). Se rechaza por causar fricción al usuario.

2. **Propagación de Correcciones vía Callback/Context (`onUpdateReport`)**:
   - *Decisión*: Extender `AnalysisContext` y la prop `onUpdateReport` en `ComparisonReport` para mutar la cotización en `report.quotes` cuando el usuario guarde una corrección en `CorrectionUI`.
   - *Alternativa*: Guardar únicamente en el backend sin actualizar la memoria de React. Se rechaza porque el PDF exportado usaba la memoria obsoleta.

3. **Ubicación del Selector de Ramo**:
   - *Decisión*: Colocar el selector de dominio en la sección de configuración superior (junto a `ClientSelector`) en `App.tsx`.

## Risks / Trade-offs

- **[Riesgo]** Conflicto entre correcciones locales y re-análisis completo.
  - *Mitigación*: Las correcciones locales aplican al `report` generado actual. Si el usuario realiza un re-análisis desde cero con nuevos archivos, se resetean las correcciones.
