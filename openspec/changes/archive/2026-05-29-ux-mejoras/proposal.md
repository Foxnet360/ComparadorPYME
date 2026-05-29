## Why

La experiencia de usuario actual del comparador de seguros trata los datos como una hoja de cálculo estática. El analista actúa de forma reactiva, sin guía sobre discrepancias críticas, sin capacidad de validar evidencias PDF en contexto, y sin mecanismo real de retroalimentación al motor de aprendizaje. Esta fricción reduce la precisión del análisis y desperdicia la oportunidad de refinar la IA con la experiencia del analista.

## What Changes

- **Visor PDF Interactivo Integrado**: Reemplazar popovers estáticos con un visor lateral (drawer/split-screen) que cargue PDFs directamente en la página de evidencia, permitiendo validación visual inmediata de snippets RAG.
- **Conexión HITL Real**: Conectar el dropdown de correcciones inline y el panel de correcciones al endpoint `POST /api/analysis/correction`, con actualización optimista de estado, manejo de errores, y feedback visual inmediato.
- **Asistente de Auditoría (Wizard)**: Panel guía en la parte superior de la pestaña de auditoría que muestre discrepancias críticas pendientes, permita navegación de un clic a la fila correspondiente, y muestre progreso de validación.
- **Notas Consultivas en Celda**: Habilitar doble-clic en celdas para agregar anotaciones técnicas del analista que se persistan y se incluyan en exportaciones.
- **Rediseño Visual Premium**: Aplicar sistema estético glassmorphic con indicadores visuales refinados (ganadores, exclusiones, discrepancias) manteniendo accesibilidad WCAG 2.1 AA.
- **Virtualización de Matriz**: Implementar virtualización para mantener rendimiento con múltiples aseguradoras y coberturas.

## Capabilities

### New Capabilities
- `interactive-pdf-viewer`: Visor de PDF integrado con navegación a página específica y resaltado de texto, operando en modo drawer (desktop), modal (tablet) y fullscreen (mobile).
- `hitl-correction-workflow`: Flujo completo de corrección human-in-the-loop con API real, estado optimista, manejo de errores, y sincronización offline.
- `audit-wizard`: Asistente guiado de auditoría con conteo de discrepancias, navegación inteligente a filas, e indicador de progreso circular.
- `consultative-notes`: Sistema de anotaciones inline en celdas de la matriz con editor markdown, persistencia, e inyección en exportaciones PDF/Excel.

### Modified Capabilities
- `unified-coverage-matrix`: Agregar semántica ARIA (role="grid", navegación por teclado), virtualización, celdas con doble-clic para notas, y disparadores para visor PDF. Los cambios son de implementación y accesibilidad, no de requisitos funcionales base.
- `learning-engine`: Extender esquema de correcciones para incluir `rawTextSnippet`, `pageNumber`, e `aiJustification` en el payload de `POST /api/analysis/correction`.

## Impact

- **Frontend**: `components/ComparisonReport.tsx`, `components/UnifiedCoverageMatrix.tsx`, `components/AuditSection.tsx`, `components/CorrectionUI.tsx`, nuevos componentes `PdfViewer.tsx`, `AuditWizard.tsx`.
- **Backend**: `server/src/controllers/analysisValidationController.ts` (validación Zod, idempotencia), `server/src/services/learningEngine.ts` (esquema extendido).
- **Dependencias**: `pdfjs-dist` (ya instalado), posiblemente `react-window` o `@tanstack/react-virtual` para virtualización.
- **APIs**: `POST /api/analysis/correction` (esquema extendido, sin breaking changes - campos nuevos opcionales).
- **Base de datos**: Tabla `coverage_mappings` ya tiene columnas `raw_text_snippet`, `page_number`, `ai_justification` (agregadas en cambio previo `high-certainty-ontology-redesign`).
- **Accesibilidad**: Cumplimiento WCAG 2.1 AA obligatorio en todos los componentes nuevos y modificados.
