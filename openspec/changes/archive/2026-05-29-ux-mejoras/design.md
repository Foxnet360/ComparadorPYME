## Context

El comparador de seguros CSA actual tiene una interfaz funcional pero estática. Los componentes clave (`ComparisonReport`, `UnifiedCoverageMatrix`, `AuditSection`) manejan estado local de forma independiente, lo que dificulta mantener consistencia cuando el usuario interactúa con múltiples partes de la UI. El backend ya tiene el endpoint `POST /api/analysis/correction` implementado y la tabla `coverage_mappings` tiene las columnas extendidas (`raw_text_snippet`, `page_number`, `ai_justification`) del cambio previo `high-certainty-ontology-redesign`.

La base tecnológica es sólida: React 19, pdfjs-dist instalado, Tailwind CSS, Supabase, Redis. El problema es la capa de presentación y la falta de conexión real entre UI y motor de aprendizaje.

## Goals / Non-Goals

**Goals:**
- Conectar la UI de correcciones al backend real con estado optimista
- Implementar visor PDF nativo con navegación a página específica
- Agregar asistente de auditoría con navegación inteligente
- Habilitar notas consultivas en celdas con sanitización
- Cumplir WCAG 2.1 AA en todos los componentes nuevos
- Mantener rendimiento fluido con virtualización

**Non-Goals:**
- Modificar el pipeline de extracción de PDFs (backend ya funciona)
- Cambiar la ontología de coberturas (ya existe)
- Implementar autenticación o autorización
- Soportar edición de PDFs (solo lectura)
- Crear aplicación móvil nativa (responsive web solamente)

## Decisions

### 1. Estado centralizado con React Context + useReducer
**Decisión**: En lugar de manejar estado local disperso en cada componente, usar un `AnalysisContext` centralizado.

**Rationale**: 
- Múltiples componentes necesitan acceder y modificar el mismo estado (correcciones, notas, visor PDF)
- React 19 Actions con `useOptimistic` requieren un punto central para manejar pending states
- Evita prop drilling y sincronización manual

**Alternativas consideradas**:
- Zustand: Más ligero pero agrega dependencia externa. Context + useReducer es suficiente para este alcance.
- Redux: Demasiado boilerplate para un solo flujo de trabajo.

### 2. PDF.js nativo en lugar de iframe
**Decisión**: Implementar visor con PDF.js renderizando a canvas, no usar iframe con `#page=N`.

**Rationale**:
- `iframe#pag e=N` no funciona en la mayoría de navegadores para navegación programática
- PDF.js permite búsqueda y resaltado de texto exacto
- Control total sobre UI y accesibilidad

**Alternativas consideradas**:
- react-pdf: Buena pero menos control sobre resaltado de texto
- PDF embed del navegador: Sin control programático ni resaltado

### 3. Markdown + DOMPurify para notas
**Decisión**: Usar markdown para notas consultivas en lugar de HTML enriquecido.

**Rationale**:
- Markdown es intrínsecamente más seguro que HTML (no permite scripts)
- DOMPurify como capa adicional de sanitización
- Suficiente para negritas, listas, y links básicos que necesita un analista

**Alternativas consideradas**:
- Editor WYSIWYG (Quill, TinyMCE): Más pesado y requiere sanitización compleja
- Solo texto plano: Demasiado limitante para insights técnicos

### 4. Virtualización con @tanstack/react-virtual
**Decisión**: Usar `@tanstack/react-virtual` en lugar de `react-window`.

**Rationale**:
- API más moderna y flexible
- Mejor soporte para grids horizontales y verticales
- Integración natural con React 18+ concurrent features

**Alternativas consideradas**:
- react-window: Funcional pero en modo mantenimiento
- Virtualización nativa CSS: No maneja bien grids complejas con celdas variables

### 5. Modo responsivo del visor PDF: Drawer/Modal/Fullscreen
**Decisión**: Tres modos basados en breakpoints en lugar de un solo diseño adaptable.

**Rationale**:
- Desktop (>1024px): Split-screen es el patrón más productivo para comparación
- Tablet (768-1024px): Modal centrado balancea espacio y legibilidad
- Mobile (<768px): Fullscreen es la única opción usable para PDFs

**Alternativas consideradas**:
- Siempre drawer: Imposible en mobile
- Siempre modal: Ineficiente en desktop con pantalla grande

## Risks / Trade-offs

**[Riesgo] PDF.js bundle size (~2MB)** → **Mitigación**: Lazy loading del componente PdfViewer. Solo carga cuando el usuario abre evidencia.

**[Riesgo] Virtualización rompe búsqueda nativa del navegador (Ctrl+F)** → **Mitigación**: Implementar búsqueda propia dentro de la matriz virtualizada.

**[Riesgo] Estado optimista puede confundir si el backend rechaza** → **Mitigación**: Reversión automática con animación suave y toast explicativo.

**[Riesgo] Accesibilidad ARIA grid es compleja de implementar correctamente** → **Mitigación**: Usar hook reutilizable `useGridKeyboardNavigation` y testear con axe-core.

**[Riesgo] Doble-clic en celdas puede conflictuar con single-clic** → **Mitigación**: Single-clic selecciona celda (foco), doble-clic abre editor. Usar `onClick` + `onDoubleClick` con timer de 300ms.

**[Trade-off] Funcionalidad vs. Simplicidad**: El wizard de auditoría agrega complejidad pero reduce drásticamente la carga cognitiva del analista.

## Migration Plan

**Fase 1 (Semana 1)**: Fundamentos
- Crear `AnalysisContext` con useReducer
- Implementar `useOptimisticCorrection` hook
- Agregar validación Zod en backend

**Fase 2 (Semana 2)**: HITL Real
- Conectar dropdowns a API real
- Implementar retry logic y offline queue
- Tests de integración

**Fase 3 (Semana 3)**: Visor PDF
- Implementar PdfViewer con PDF.js
- Modos responsive
- Resaltado de texto

**Fase 4 (Semana 4)**: Matriz Premium
- Virtualización
- ARIA roles
- Notas inline

**Fase 5 (Semana 5)**: Wizard
- Panel de discrepancias
- Navegación inteligente
- Progreso circular

**Fase 6 (Semana 6)**: Testing & QA
- Unit tests (>80%)
- E2E tests
- Accessibility audit
- Performance audit

**Rollback**: Cada fase es independiente. Si hay problemas, se puede desactivar con feature flags.

## Open Questions

1. **¿El backend soporta idempotencia en correcciones?** Actualmente no hay `correctionId`. ¿Agregar UUID en frontend o backend?
2. **¿Cuál es el límite razonable de caracteres para notas consultivas?** Propuesta: 2000 caracteres.
3. **¿Se necesita sincronización offline real (service worker) o solo localStorage queue?** Para MVP: localStorage queue es suficiente.
4. **¿Se permite múltiples notas por celda o solo una?** Una nota por celda para simplificar.
5. **¿El resaltado de PDF.js requiere worker separado en producción?** Sí, configurar `GlobalWorkerOptions.workerSrc` apuntando a CDN o build output.
