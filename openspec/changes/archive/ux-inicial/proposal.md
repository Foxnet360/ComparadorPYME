# Proposal: Rediseño UX/GUI Inicial - Comparador de Seguros PYME

## Intent
Transformar la experiencia de usuario (UX) e interfaz gráfica (GUI) del analista técnico de seguros, unificando la nomenclatura de dominio ("Comparación"), optimizando el Panel de Control, habilitando la selección de los 8 ramos corporativos, simplificando la creación de análisis y modernizando la pantalla de espera con transparencia sobre el pipeline real de IA.

## Scope

### 1. Panel de Control (Dashboard Técnico)
- Sustituir la lista plana gigante de cotizaciones por un Dashboard analítico con tarjetas de métricas (KPIs).
- Incorporar filtros de búsqueda por aseguradora, cliente, rango de fecha, ramo y estado.
- Tabla estructurada con acciones rápidas: ver informe, exportar Excel, abrir chat de consulta.

### 2. Unificación Terminológica de Dominio ("Comparación")
- Reemplazar cualquier mención inconsistente a "Auditoría" ("Nueva auditoría", "Auditando clausulados") por **"Comparación"** ("Nueva Comparación", "Comparando Clausulados", "Informe Comparativo").

### 3. Selección Multidominio (8 Ramos)
- Expandir el selector de 2 a los **8 ramos** soportados por la ontología de seguros:
  1. PYME Multirriesgo
  2. Todo Riesgo Daños Materiales
  3. Responsabilidad Civil General
  4. Sustracción y Hurto
  5. Transporte de Mercancías
  6. Manejo e Infidelidad de Empleados
  7. Equipo Electrónico
  8. Rotura de Maquinaria

### 4. Flujo de "Nueva Comparación"
- Eliminar el duplicado de selección/creación de clientes, dejando una interfaz unificada con autocompletado y creación fluida inline.
- Rediseñar la sección de carga/selección de clausulados con Drag-and-Drop, auto-detección de ramo y feedback visual inmediato.

### 5. Pantalla de Espera Informativa ("Comparando Clausulados")
- Reemplazar textos desactualizados por una pantalla con progreso por etapas explicadas en lenguaje natural técnico:
  - Etapa 1: Lectura multimodal OCR de documentos.
  - Etapa 2: Normalización ontológica con Gemini 3.5.
  - Etapa 3: Reconciliación cruzada de coberturas y deducibles.
  - Etapa 4: Scoring y análisis de riesgos.
- Carousel de características destacadas de la herramienta durante el tiempo de espera.

## Success Criteria
- Panel de control intuitivo con métricas visuales y tabla filtrable.
- Nomenclatura 100% consistente con el término "Comparación".
- Selección funcional de 8 ramos en el flujo de análisis.
- Carga de cotizaciones y selección de cliente sin elementos duplicados.
- Pantalla de espera interactiva y precisa con las tecnologías reales en uso.
