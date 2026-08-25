# Tasks: Rediseño UX/GUI Inicial - Comparador de Seguros PYME

## Phase 1: Unificación Terminológica & Constantes de Ramos
- [ ] 1.1 Actualizar `constants.ts` para ampliar los ramos (`DOMAINS`) a los 8 ramos corporativos.
- [ ] 1.2 Auditar y reemplazar el término "Auditoría" por **"Comparación"** en headers, sidebars, modales y botones.

## Phase 2: Rediseño del Panel de Control (`TechnicalDashboard.tsx`)
- [ ] 2.1 Crear tarjetas KPI superiores para el analista (Total Comparaciones, Conversión %, Prima Total, Prospectos Activos).
- [ ] 2.2 Implementar barra de filtros avanzados (Búsqueda global, Ramo, Aseguradora, Fechas).
- [ ] 2.3 Refactorizar la tabla de historial de comparaciones con acciones rápidas.

## Phase 3: Optimización del Flujo "Nueva Comparación" (`NewAnalysis.tsx`)
- [ ] 3.1 Unificar el selector duplicado de cliente en un único componente `ClientSelector` con creación inline.
- [ ] 3.2 Implementar grid/desplegable de selección para los 8 ramos.
- [ ] 3.3 Rediseñar la zona Drag-and-Drop de cotizaciones y clausulados maestros con feedback visual claro.

## Phase 4: Modernización de la Pantalla de Espera (`LoadingAnalysisState.tsx`)
- [ ] 4.1 Actualizar el copy y título a "Comparando Clausulados y Cotizaciones...".
- [ ] 4.2 Configurar el indicador de etapas reales (OCR, Gemini 3.5, Reconciliación Deducibles, Scoring).
- [ ] 4.3 Añadir carousel interactivo de tips técnicos y capacidades de la herramienta.

## Phase 5: Verificación & Pruebas
- [ ] 5.1 Ejecutar `npm run build` y `npm test` para asegurar compatibilidad.
- [ ] 5.2 Validar navegación fluida y ausencia de regresiones.
