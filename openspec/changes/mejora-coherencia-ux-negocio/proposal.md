## Why

Existen desalineaciones entre la experiencia de usuario (UX) y la lógica de negocio durante el flujo de auditoría de cotizaciones:
1. Las fallas de red/API en la etapa de análisis ejecutan un reseteo destructivo que elimina los archivos subidos.
2. Las correcciones manuales hechas en la UI de edición no se reflejan en la matriz global ni en el PDF exportado.
3. El dominio de negocio (PYME vs. Autos) está acoplado internamente al componente de carga y no se resetea entre auditorías.
4. El bloqueo por cliente no seleccionado genera confusión de interfaz.
5. El reporte comparativo no adapta sus títulos ni métricas según el ramo auditado.

Resolver estas desalineaciones garantizará una experiencia fluida, consistente y sin pérdida de datos para los usuarios corredores de seguros.

## What Changes

- **Flujo de Reintento No Destructivo**: Modificar la gestión de errores en `App.tsx` para que un fallo en la API devuelva un estado de error recuperable conservando `quoteFiles`, `clauseFiles`, `selectedClauseIds` y `selectedClient`.
- **Propagación Global de Correcciones**: Conectar el evento de corrección manual (`CorrectionUI`) con el estado global `report` en `App.tsx` y `AnalysisContext`, garantizando que la matriz y el PDF se actualicen dinámicamente.
- **Ubicación y Sincronización del Selector de Dominio**: Extraer la selección de dominio (PYME / Autos) a la barra principal de configuración del análisis, asegurando que se reinicie o sincronice al cambiar de cliente o iniciar una nueva auditoría.
- **Feedback Visual de Requisito de Cliente**: Agregar mensajes descriptivos e indicadores claros cuando el uploader se encuentra deshabilitado por falta de selección de cliente.
- **Presentación Orientada al Ramo**: Adaptar los encabezados, agrupaciones de coberturas y terminología del `ComparisonReport` según si el dominio es `pyme` o `autos`.

## Capabilities

### New Capabilities
- `audit-workflow-resilience`: Garantiza la persistencia y recuperación de datos de entrada ante errores en el proceso de análisis.
- `correction-state-propagation`: Permite la mutación y sincronización en tiempo real de correcciones de usuario sobre el reporte y la generación de PDF.
- `multiramo-domain-flow`: Establece la selección del ramo de negocio en el nivel superior del flujo y mantiene su consistencia de estado.
- `client-selector-feedback`: Proporciona retroalimentación de interfaz y llamadas a la acción claras para la selección previa de clientes.
- `domain-aware-report-presentation`: Presenta la matriz de coberturas y métricas con terminología adaptada al ramo (Autos / PYME).

### Modified Capabilities
*(Ninguna capacidad existente previa especificada)*

## Impact

- **Código Afectado**: `App.tsx`, `components/FileUploader.tsx`, `components/ComparisonReport.tsx`, `components/CorrectionUI.tsx`, `services/pdfService.ts`, `contexts/AnalysisContext.tsx`.
- **APIs**: Ningún cambio en contratos backend existentes.
- **Dependencias**: Ninguna nueva dependencia requerida.
