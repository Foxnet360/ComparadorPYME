# Design: Rediseño UX/GUI Inicial - Comparador de Seguros PYME

## Architectural Goals
1. **Unificación Terminológica:** Estandarizar componentes de UI y copy para utilizar el término "Comparación" en toda la aplicación.
2. **Dashboard de Alta Densidad Informativa:** Reestructurar `TechnicalDashboard.tsx` para proporcionar visualización ejecutiva y operativa al analista.
3. **Carga y Configuración Simplificada:** Optimizar `NewAnalysis.tsx` unificando la selección de cliente y enriqueciendo la selección de ramo y clausulados.
4. **Retroalimentación de Proceso en Tiempo Real:** Actualizar la pantalla de carga/progreso para reflejar con precisión el pipeline multimodal de Gemini 3.5 y Supabase PGVector.

## Component Refactoring Map

### 1. `components/TechnicalDashboard.tsx`
- **Componentes KPI:** Tarjetas superiores para Total Comparaciones, Conversión %, Prima Total Cotizada, Prospectos Activos.
- **Filtros Operativos:** Barra superior con búsqueda por texto (cliente/aseguradora), filtro desplegable por Ramo (8 opciones), selector de fecha y estado.
- **Tabla de Comparaciones:** Columnas claras (Fecha, Cliente, Aseguradoras Cotizadas, Mejor Opción, Prima Total, Estado, Acciones).

### 2. `components/NewAnalysis.tsx`
- **Título:** Cambiar de "Nueva Auditoría" a "Nueva Comparación de Seguros".
- **Selección de Cliente:** Unificar la doble caja actual en una única tarjeta interactiva `ClientSelector` con autocompletado y botón " + Crear Cliente".
- **Selector de Ramo:** Desplegable o grid de tarjetas con los 8 ramos (PYME, Daños Materiales, RC, Sustracción, Transportes, Manejo, Equipo Electrónico, Rotura de Maquinaria).
- **Carga de Clausulados y Cotizaciones:** Área unificada Drag & Drop con soporte visual para PDFs, indicador de páginas y plantilla auto-detectada.

### 3. `components/LoadingAnalysisState.tsx` (o Pantalla de Carga)
- **Título:** "Comparando Clausulados y Cotizaciones...".
- **Stepping Visual:**
  - 1. Extracción Multimodal OCR y Parsing de PDFs.
  - 2. Normalización Ontológica con Gemini 3.5 Flash.
  - 3. Matriz de Deducibles y Coincidencia Cruzada de Coberturas.
  - 4. Matriz de Scoring y Evaluación de Riesgos.
- **Feature Highlights:** Carousel informativo con tips de uso, reglas de negocio del mercado colombiano y capacidades del motor.

## Data & Constants Updates

### `constants.ts` / `types.ts`
- Actualizar lista de ramos permitidos (`DOMAINS`):
  ```ts
  export const DOMAINS = [
    { id: 'pyme', name: 'PYME Multirriesgo' },
    { id: 'danos_materiales', name: 'Todo Riesgo Daños Materiales' },
    { id: 'responsabilidad_civil', name: 'Responsabilidad Civil General' },
    { id: 'sustraccion', name: 'Sustracción y Hurto' },
    { id: 'transporte', name: 'Transporte de Mercancías' },
    { id: 'manejo', name: 'Manejo e Infidelidad de Empleados' },
    { id: 'equipo_electronico', name: 'Equipo Electrónico' },
    { id: 'rotura_maquinaria', name: 'Rotura de Maquinaria' },
  ];
  ```
