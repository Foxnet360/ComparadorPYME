## 1. Arquitectura Base y Estado Centralizado

- [x] 1.1 Crear `contexts/AnalysisContext.tsx` con useReducer para estado global del análisis
- [x] 1.2 Crear `hooks/useOptimisticCorrection.ts` usando React 19 `useOptimistic`
- [x] 1.3 Crear `schemas/correction.ts` con validación Zod para payload de correcciones
- [x] 1.4 Crear `schemas/note.ts` con validación Zod para notas consultivas
- [x] 1.5 Crear `lib/fetchWithRetry.ts` con retry exponencial y circuit breaker
- [x] 1.6 Crear `services/correctionQueue.ts` para cola offline con localStorage

## 2. Backend - API de Correcciones Robustecida

- [x] 2.1 Agregar validación Zod en `server/src/controllers/analysisValidationController.ts` para POST /api/analysis/correction
- [x] 2.2 Implementar idempotencia con correctionId único (UUID)
- [x] 2.3 Extender esquema de corrección para aceptar rawTextSnippet, pageNumber, aiJustification
- [x] 2.4 Agregar transacciones de base de datos en saveCorrection
- [x] 2.5 Crear tests de integración para el endpoint de correcciones

## 3. Visor PDF Interactivo

- [x] 3.1 Crear `components/PdfViewer.tsx` con PDF.js renderizando a canvas
- [x] 3.2 Crear `hooks/usePdfDocument.ts` para cargar y navegar documentos PDF
- [x] 3.3 Implementar navegación automática a página específica (pageNumber)
- [x] 3.4 Implementar resaltado de texto (rawTextSnippet) en página actual
- [x] 3.5 Crear `hooks/useBreakpoint.ts` para detectar tamaño de viewport
- [x] 3.6 Implementar modo drawer en desktop (>1024px)
- [x] 3.7 Implementar modo modal en tablet (768-1024px)
- [x] 3.8 Implementar modo fullscreen en mobile (<768px) con swipe
- [x] 3.9 Agregar controles de navegación (anterior/siguiente, zoom)
- [x] 3.10 Configurar `GlobalWorkerOptions.workerSrc` para producción

## 4. Conexión HITL Real

- [x] 4.1 Conectar `handleDiscrepancyResolution` en `UnifiedCoverageMatrix` a API real
- [x] 4.2 Conectar `onCorrection` en `CorrectionUI` a API real
- [x] 4.3 Implementar estado optimista con `useOptimistic`
- [x] 4.4 Implementar feedback visual: pending (spinner), success (check verde), error (reversión)
- [x] 4.5 Implementar toast notifications accesibles para cada estado
- [x] 4.6 Integrar cola offline para correcciones sin conexión
- [x] 4.7 Sincronizar automáticamente cola offline al recuperar conexión

## 5. Matriz de Coberturas Mejorada

- [x] 5.1 Agregar semántica ARIA: role="grid", role="row", role="gridcell", aria-rowcount
- [x] 5.2 Crear `hooks/useGridKeyboardNavigation.ts` para navegación por teclado
- [x] 5.3 Implementar `components/VisuallyHidden.tsx` para anuncios de screen readers
- [x] 5.4 Agregar doble-clic en celdas para abrir editor de notas
- [x] 5.5 Agregar botón "Ver Evidencia" en celdas con pageNumber
- [x] 5.6 Implementar virtualización con `@tanstack/react-virtual`
- [x] 5.7 Optimizar re-renders con React.memo en CoverageCell
- [x] 5.8 Implementar lazy loading del componente PdfViewer

## 6. Notas Consultivas Inline

- [x] 6.1 Crear editor markdown inline en celdas (doble-clic)
- [x] 6.2 Implementar `utils/sanitizeNote.ts` con DOMPurify + markdown
- [x] 6.3 Agregar icono indicador de nota (📌) en celdas con contenido
- [x] 6.4 Implementar tooltip con renderizado de markdown
- [x] 6.5 Persistir notas en estado del reporte (ComparisonReport)
- [x] 6.6 Inyectar notas en exportación PDF (columna "Insights del Consultor")
- [x] 6.7 Inyectar notas en exportación Excel

## 7. Asistente de Auditoría (Wizard)

- [x] 7.1 Crear `components/AuditWizard.tsx` con panel de discrepancias
- [x] 7.2 Implementar conteo dinámico de discrepancias por tipo
- [x] 7.3 Implementar navegación de un clic con scrollIntoView a filas
- [x] 7.4 Agregar resaltado temporal de fila (2 segundos)
- [x] 7.5 Implementar indicador de progreso circular accesible (role="progressbar")
- [x] 7.6 Agrupar alertas por severidad con secciones colapsables
- [x] 7.7 Implementar mensaje personalizado con nombre del analista

## 8. Diseño Visual Premium

- [x] 8.1 Implementar sistema de colores glassmorphic en celdas
- [x] 8.2 Celda ganadora: degradado ámbar-dorado sutil + borde dorado
- [x] 8.3 Celda exclusión: degradado carmesí suave + borde rojo sutil
- [x] 8.4 Celda discrepancia: bordes amarillos con patrón warning stripe
- [x] 8.5 Animaciones de transición con framer-motion
- [x] 8.6 Asegurar contraste WCAG AA en todos los estilos nuevos

## 9. Testing y Accesibilidad

- [x] 9.1 Crear `components/__tests__/CorrectionFlow.test.tsx`
- [x] 9.2 Crear `components/__tests__/PdfViewer.test.tsx`
- [x] 9.3 Crear tests de accesibilidad con axe-core para matriz
- [ ] 9.4 Implementar tests E2E para flujo completo de auditoría
- [ ] 9.5 Verificar navegación por teclado en todos los componentes nuevos
- [ ] 9.6 Ejecutar Lighthouse audit (Performance >90, Accessibility >95)

## 10. Documentación y Limpieza

- [x] 10.1 Actualizar README con nuevas funcionalidades
- [x] 10.2 Documentar API extendida de correcciones
- [x] 10.3 Agregar ejemplos de uso del visor PDF en documentación
- [x] 10.4 Limpiar console.logs de debugging
- [x] 10.5 Verificar que no hay secretos o credenciales en código nuevo